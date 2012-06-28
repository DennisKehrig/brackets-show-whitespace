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
/*global define, $, brackets, less, Node */


define(function (require, exports, module) {
	'use strict';

	
	// --- Required modules ---
	
	var Commands           = brackets.getModule("command/Commands");
	var CommandManager     = brackets.getModule("command/CommandManager");
	var DocumentManager    = brackets.getModule("document/DocumentManager");
	var EditorManager      = brackets.getModule("editor/EditorManager");
	var Menus              = brackets.getModule("command/Menus");
	var PreferencesManager = brackets.getModule("preferences/PreferencesManager");

	
	// --- Settings ---
	
	var preferencesId      = "denniskehrig.ShowIndentation";
	var defaultPreferences = { checked: false };
	var commandId          = "denniskehrig.ShowIndentation.toggle";
	var lineSelector       = '>pre';
	var updateDelay        = 20;
	var updateEvents       = 'DOMNodeInserted DOMNodeRemoved';
	var defaultTabWidth    = 4;

	
	// --- State Variables ---
	
	var _preferences;
	var _command;
	var _$styleTag;
	
	var _$lineParent;
	var _$indentParent;
	var _tabWidth;
	
	var _updateTimeout;


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
		
		if (! _command.getChecked()) {
			hideIndentations();
		} else if (DocumentManager.getCurrentDocument()) {
			showIndentations();
		}
	}

	function onCurrentDocumentChange() {
		hideIndentations();
		if (_command.getChecked() && DocumentManager.getCurrentDocument()) {
			showIndentations();
		}
	}
	
	function onDomModification(event) {
		window.clearTimeout(_updateTimeout);
		_updateTimeout = window.setTimeout(updateIndentations, updateDelay);
	}

	// Functionality

	function showIndentations() {
		if (! _$indentParent || ! _$lineParent) {
			_tabWidth = getTabWidth();
			
			_$lineParent   = $('.CodeMirror-lines > div > div:last-child');
			_$indentParent = $("<div>").attr("id", "denniskehrig-ShowIndentation-indentations").insertAfter(_$lineParent);
			
			_$lineParent.on(updateEvents, onDomModification);
			_$indentParent.show();
		}
		
		updateIndentations();
	}

	function hideIndentations() {
		if (_$lineParent) {
			_$lineParent.off(updateEvents, onDomModification);
			_$lineParent = null;
		}
		
		if (_$indentParent) {
			_$indentParent.remove();
			_$indentParent = null;
		}
		
		window.clearTimeout(_updateTimeout);
	}

	function updateIndentations() {
		var $lines = _$lineParent.find(lineSelector);
		var $indents = _$indentParent.children();

		// Remove indentations for lines that don't exist anymore
		for (var i = $indents.length - 1; i >= $lines.length; i--) {
			$indents.eq(i).remove();
		}

		// Go through each line and update the indentations
		// TODO: optimize to update only changed lines (tedious to detect)
		$lines.each(function (index) {
			var indentation, hasContent, i, node, text, length;
			
			indentation = "";
			hasContent  = false;

			for (i = 0; i < this.childNodes.length; i++) {
				node = this.childNodes[i];
				// Not an indentation node => reached end of indentation
				if (! (text = textOfIndentationNode(node))) {
					hasContent = true;
					break;
				}
				length = text.length;
				text = text.replace(/[^\t ].*$/, '');
				indentation += text;
				// Text contains not just spaces and tabs => reached end of indentation
				if (text.length !== length) {
					hasContent = true;
					break;
				}
			}

			// Probably just a <pre> with one space just so it has a height => empty line
			if (indentation === " " && ! hasContent) {
				indentation = "";
			}

			if (indentation === "") {
				// One space so our <pre> has a height
				indentation = " ";
			} else {
				// Replace the white-space based indentation with · for spaces and <span> for tabs
				indentation = stringForIndentation(indentation, _tabWidth);
			}

			// Reuse or create the indentation pre for the current line
			var $indent;
			if (index >= $indents.length) {
				$indent = $("<pre>").appendTo(_$indentParent);
			} else {
				$indent = $indents.eq(index);
			}

			// Update the indentation marker and move it to the correct position
			// Setting the top is necessary
			$indent.html(indentation).css('top', this.offsetTop);
		});
	}

	function textOfIndentationNode(node) {
		if (node.nodeType === Node.TEXT_NODE) {
			return node.nodeValue;
		}
		
		var klass;
		if (node.nodeType === Node.ELEMENT_NODE && (klass = node.getAttribute("class")) && klass.slice(0, 6) === "cm-tab") {
			return "\t";
		}
	}

	function stringForIndentation(string, tabWidth) {
		var indentation = "", length = 0;
		
		for (var i = 0; i < string.length; i++) {
			var c = string.charAt(i);
			if (c === '\t') {
				var add = (tabWidth - (length % tabWidth));
				length += add;
				indentation += '<span>';
				while (add--) {
					indentation += ' ';
				}
				indentation += '</span>';
			} else {
				indentation += '·';
				length += 1;
			}
		}

		return indentation;
	}

	
	// --- Helper Functions ---
	
	function getTabWidth() {
		var editor = EditorManager.getCurrentFullEditor();
		if (editor && editor._codeMirror) {
			return editor._codeMirror.getOption("tabSize");
		}
		console.log("Using default tab width");
		return defaultTabWidth;
	}

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
		$(_command).off("checkedStateChange", onCheckedStateChange);
		_command._commandFn = null;
	}

	
	function loadMenuItem() {
		Menus.getMenu("view-menu").addMenuItem(commandId, "Ctrl-Shift-W");
	}

	function unloadMenuItem() {
		Menus.getMenu("view-menu").removeMenuItem(commandId);
	}

	
	function loadDocumentManager() {
		$(DocumentManager).on("currentDocumentChange", onCurrentDocumentChange);
	}
	
	function unloadDocumentManager() {
		$(DocumentManager).off("currentDocumentChange", onCurrentDocumentChange);
	}

	
	// Setup the UI
	function load() {
		loadPreferences();
		loadStyle();
		loadCommand();
		loadMenuItem();
		loadDocumentManager();
	}

	// Tear down the UI
	function unload() {
		unloadDocumentManager();
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