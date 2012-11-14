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

		// Closure to make our getHTML independent of this extension
		var _super = _Line.getHTML;
		_Line.getHTML = function getHTML(makeTab, wrapAt, wrapId, wrapWBR) {
			var html = _super.apply(this, arguments);
			
			// Nothing to do
			if (! _command || ! _command.getChecked() || html === " ") { return html; }
			
			var space = '<span class="cm-space indentation"> </span>';
			var tabOn = '<span class="cm-tab indentation">';
			var tabOff = '</span>';
			var cmTabOn = '<span class="cm-tab">';
			
			var prefix = [];
			var offset = 0;
			
			while (true) {
				if (html.slice(offset, offset + 1) === ' ') {
					offset += 1;
					prefix.push(space);
				}
				else if (html.slice(offset, offset + cmTabOn.length) === cmTabOn) {
					offset += cmTabOn.length;
					var stop = html.indexOf(tabOff, offset);
					prefix.push(tabOn, html.slice(offset, stop), tabOff);
					offset += stop - offset + tabOff.length;
				}
				else {
					break;
				}
			}

			prefix.push(html.slice(offset));
			return prefix.join("");
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
	
	/** Find the URL to this extension's directory */
	function extensionDirUrl() {
		var url = brackets.platform === "win" ? "file:///" : "file://localhost";
		url += require.toUrl("./").replace(/\.\/$/, "");
		
		return url;
	}

	/** Loads a less file as CSS into the document */
	function loadLessFile(file, dir) {
		var result = $.Deferred();

		// Load the Less code
		$.get(dir + file)
			.done(function (code) {
				// Parse it
				var parser = new less.Parser({ filename: file, paths: [dir] });
				parser.parse(code, function onParse(err, tree) {
					console.assert(!err, err);
					// Convert it to CSS and append that to the document head
					var $node = $("<style>").text(tree.toCSS()).appendTo(window.document.head);
					result.resolve($node);
				});
			})
			.fail(function (request, error) {
				result.reject(error);
			})
		;
		
		return result.promise();
	}

	
	// --- Loaders and Unloaders ---

	function loadPreferences() {
		_preferences = PreferencesManager.getPreferenceStorage(preferencesId, defaultPreferences);
	}


	function loadStyle() {
		loadLessFile("main.less", extensionDirUrl()).done(function ($node) {
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
		Menus.getMenu("view-menu").addMenuItem(commandId, "Ctrl-Alt-W");
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