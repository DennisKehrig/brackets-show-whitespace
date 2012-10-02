/*
 * The MIT License (MIT)
 * Copyright (c) 2012 Dennis Kehrig. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 *
 */

/*jslint vars: true, plusplus: true, devel: true, regexp: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, $, brackets, less, Node, CodeMirror */


define(function (require, exports, module) {
	'use strict';

	
	// --- Required modules ---

	var Commands           = brackets.getModule("command/Commands");
	var CommandManager     = brackets.getModule("command/CommandManager");
	var EditorManager      = brackets.getModule("editor/EditorManager");
	var Menus              = brackets.getModule("command/Menus");
	var PreferencesManager = brackets.getModule("preferences/PreferencesManager");

	
	// --- Settings ---
	
	var preferencesId      = "denniskehrig.ShowIndentation";
	var defaultPreferences = { checked: false };
	var commandId          = "denniskehrig.ShowIndentation.toggle";

	
	// --- State Variables ---
	
	var _preferences;
	var _command;
	var _$styleTag;

	var _Line;
	var _LineGetHTML;
	

	// --- Event Handlers ---

	function onCommandExecuted() {
		if (! _command.getChecked()) {
			_command.setChecked(true);
		} else {
			_command.setChecked(false);
		}
	}

	function onCheckedStateChange() {
		_preferences.setValue("checked", Boolean(_command.getChecked()));
		refreshCodeMirror();
	}

	// Functionality

	function refreshCodeMirror() {
		var fullEditor = EditorManager.getCurrentFullEditor();
		if (! fullEditor || ! fullEditor._codeMirror) { return; }

		if (_command.getChecked()) {
			patchCodeMirror(fullEditor._codeMirror);
		} else {
			unpatchCodeMirror();
		}

		fullEditor._codeMirror.refresh();
		$.each(EditorManager.getInlineEditors(fullEditor), function (index, inlineEditor) {
			inlineEditor._codeMirror.refresh();
		});
	}

	function patchCodeMirror(codeMirror) {
		// Avoid double patching
		if (_Line && _LineGetHTML) { return; }

		// Remember Line and Line.getHTML to be able to unpatch without a reference to CM
		_Line = Object.getPrototypeOf(codeMirror.getLineHandle(0));
		_LineGetHTML = _Line.getHTML;

		// Constants
		var TAG_CLOSE         = '</span>';
		var CM_TAB            = '<span class="cm-tab">';
		var TAB_NORMAL        = '<span class="cm-tab">';
		var TAB_INDENTATION   = '<span class="cm-tab indentation">';
		var SPACE_NORMAL      = '<span class="cm-space">'
		var SPACE_INDENTATION = '<span class="cm-space indentation">';

		// Closure to make our getHTML independent of this extension
		var _super = _Line.getHTML;
		_Line.getHTML = function getHTML(makeTab, wrapAt, wrapId, wrapWBR) {
			var html = _super.apply(this, arguments);
			
			// Nothing to do
			if (! _command || ! _command.getChecked() || html === " ") { return html; }
			
			// Local variables for the loop
			var pos, part;
			
			// Optimizations
			var length = html.length;

			// Output
			var output = [];
			
			// State
			var offset = 0;
			var tags   = [];
			
			var indentation = true;
			var spaceOpen   = SPACE_INDENTATION;
			var tabOpen     = TAB_INDENTATION;

			while (offset < length) {
				// Tag mode
				if (html.slice(offset, offset + 1) === '<'){
					// Look for the end of the tag
					pos  = html.indexOf('>', offset + 1);
					part = html.slice(offset, pos + 1);
					
					// Update the state
					offset = pos + 1;
					if (part.slice(1, 2) === '/') {
						tags.pop();
					} else {
						tags.push(part);
					}

					// Inject the indentation class if necessary
					if (part === CM_TAB) { part = tabOpen; }
				}
				// Text mode
				else {
					// Look for the start of a tag
					pos = html.indexOf('<', offset);
					// The entire rest of the string is escaped text
					if (pos === -1) { pos = length + 1; }
					part = html.slice(offset, pos);
					
					// Update the state
					offset = pos;

					// No need to handle empty strings
					if (part === '') { continue; }

					// Leave the spaces in tabs as they are
					if (tags[tags.length - 1] !== CM_TAB) {
						// Find out if the indentation ends in this part
						if (indentation) {
							// Consume indentation spaces
							for (pos = 0; pos < part.length && part.slice(pos, pos + 1) === ' '; pos++) {
								output.push(spaceOpen, ' ', TAG_CLOSE);
							}
							// The part contains non-space characters: end of indentation
							if (pos < part.length) {
								indentation = false;
							}
							// Remove the spaces we have consumed
							part = part.slice(pos);
							// The rest of the part will be handled further below

							// From now on, don't set the indentation class in the HTML output
							if (! indentation) {
								spaceOpen = SPACE_NORMAL;
								tabOpen   = TAB_NORMAL;
							}
						}
						
						// Mark the spaces appropriately
						part = part.replace(/ /g, spaceOpen + ' ' + TAG_CLOSE);
					}
				}
				
				// Add the part to the output
				output.push(part);
			}

			output = output.join("");
			return output;
		};
	}

	function unpatchCodeMirror() {
		if (_Line && _LineGetHTML) {
			_Line.getHTML = _LineGetHTML;
			_LineGetHTML = null;
			_Line = null;
		}
	}

	
	// --- Helper Functions ---
	
	/** Find this extension's directory relative to the brackets root */
	function extensionDirForBrowser() {
		var bracketsIndex = window.location.pathname;
		var bracketsDir   = bracketsIndex.substr(0, bracketsIndex.lastIndexOf('/') + 1);
		var extensionDir  = bracketsDir + require.toUrl('./');

		return extensionDir;
	}

	/** Loads a less file as CSS into the document */
	function loadLessFile(file, dir) {
		var result = $.Deferred();
		
		// Load the Less code
		$.get(dir + file, function (code) {
			// Parse it
			var parser = new less.Parser({ filename: file, paths: [dir] });
			parser.parse(code, function onParse(err, tree) {
				console.assert(!err, err);
				// Convert it to CSS and append that to the document head
				var $node = $("<style>").text(tree.toCSS()).appendTo(window.document.head);
				result.resolve($node);
			});
		});
		
		return result.promise();
	}

	
	// --- Loaders and Unloaders ---

	function loadPreferences() {
		_preferences = PreferencesManager.getPreferenceStorage(preferencesId, defaultPreferences);
	}


	function loadStyle() {
		loadLessFile("main.less", extensionDirForBrowser()).done(function ($node) {
			_$styleTag = $node;
		});
	}

	function unloadStyle() {
		_$styleTag.remove();
	}

	
	function loadCommand() {
		_command = CommandManager.get(commandId);
		
		if (! _command) {
			_command = CommandManager.register("Show Indentations", commandId, onCommandExecuted);
		} else {
			_command._commandFn = onCommandExecuted;
		}

		$(_command).on("checkedStateChange", onCheckedStateChange);
		
		// Apply preferences
		_command.setChecked(_preferences.getValue("checked"));
	}

	function unloadCommand() {
		_command.setChecked(false);
		$(_command).off("checkedStateChange", onCheckedStateChange);
		_command._commandFn = null;
	}

	
	function loadMenuItem() {
		Menus.getMenu("view-menu").addMenuItem(commandId, "Ctrl-Shift-W");
	}

	function unloadMenuItem() {
		// Not implemented
		// Menus.getMenu("view-menu").removeMenuItem(commandId);
	}


	// Setup the UI
	function load() {
		loadPreferences();
		loadStyle();
		loadCommand();
		loadMenuItem();
	}

	// Tear down the UI
	function unload() {
		unloadMenuItem();
		unloadCommand();
		unloadStyle();
	}


	// --- Exports ---
	
	exports.load = load;
	exports.unload = unload;

	
	// --- Initializiation ---
	
	load();
});