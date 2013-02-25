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
/*global define, $, brackets, Node, CodeMirror */

define(function (require, exports, module) {
    "use strict";
    
    
    // --- Required modules ---

    var CommandManager     = brackets.getModule("command/CommandManager");
    var DocumentManager    = brackets.getModule("document/DocumentManager");
    var EditorManager      = brackets.getModule("editor/EditorManager");
    var ExtensionUtils     = brackets.getModule("utils/ExtensionUtils");
    var Menus              = brackets.getModule("command/Menus");
    var PreferencesManager = brackets.getModule("preferences/PreferencesManager");

    
    // --- Settings ---
    
    var commandId          = "denniskehrig.ShowWhitespace.toggle";
    var preferencesId      = "denniskehrig.ShowWhitespace";
    var defaultPreferences = { checked: false };

    
    // --- State Variables ---
    
    var _preferences;
    var _command;
    var _styleTag;

    // CodeMirror 2 doesn't have addOverlay, and doesn't set a version either.
    var _useLegacyVersion = !CodeMirror.version;
    var _Line;
    var _LineGetHTML;

    // States for the overlay mode, which is supposed to be stateless and so can't use the state functionality provided by CodeMirror
    var _appendSpace    = false,
        _isLeading      = true,
        _isTrailing     = false;
    
    
    // --- Functionality ---

    var overlay = {
        token: function (stream, state) {
            var ch,
                ateCode     = false,
                lookAhead   = "",
                numChars    = 0,
                tokenStyle  = "";

            if (stream.sol()) {
                _isLeading  = true;
                _isTrailing = false;
            }
            
            // Boolean makes JSLint happy
            while (Boolean(ch = stream.peek())) {
                if (ch === " " || ch === "\t") {
                    if (ateCode) {
                        // Return now to mark all code seen so far as not necessary to highlight
                        return null;
                    }
                    // Eat the whitespace
                    stream.next();

                    // Test if this is a trailing whitespace
                    if ((!_isLeading) && (!_isTrailing)) {
                        lookAhead = stream.peek();
                        
                        while (lookAhead === " " || lookAhead === "\t") {
                            stream.next();
                            numChars++;
                            lookAhead = stream.peek();
                        }
                        
                        _isTrailing = !Boolean(lookAhead);
                        
                        // Restore the stream position
                        stream.backUp(numChars);
                    }

                    // CodeMirror merges consecutive tokens with the same style
                    // There's a setting called "flattenSpans" to prevent that, but it's for the whole editor
                    // So instead we simply append a space character to the style every other time
                    // This disables CodeMirror's string comparison while having no effect on the CSS class
                    _appendSpace = !_appendSpace;
                    
                    tokenStyle  += "dk-whitespace-";
                    tokenStyle  += (_isLeading ? "leading-" : (_isTrailing ? "trailing-" : ""));
                    tokenStyle  += (ch === " " ? "space" : "tab");
                    tokenStyle  += (_appendSpace ? " " : "");
                    
                    return tokenStyle;
                } else {
                    stream.next();
                    ateCode     = true;
                    _isLeading  = false;
                }
            }
            return null;
        }
    };
        
    function patchCodeMirror(codeMirror) {
        // Avoid double patching
        if (_Line && _LineGetHTML) { return; }

        // Remember Line and Line.getHTML to be able to unpatch without a reference to CM
        _Line = Object.getPrototypeOf(codeMirror.getLineHandle(0));
        _LineGetHTML = _Line.getHTML;

        // Constants
        var TAG_CLOSE = "</span>";
        var CM_TAB    = "<span class=\"cm-tab\">";
        var TAB       = "<span class=\"cm-tab cm-dk-whitespace-tab\">";
        var SPACE     = "<span class=\"cm-space cm-dk-whitespace-space\">";

        // Closure to make our getHTML independent of this extension
        var _super = _Line.getHTML;
        _Line.getHTML = function getHTML(makeTab, wrapAt, wrapId, wrapWBR) {
            var html = _super.apply(this, arguments);
            
            // Nothing to do
            if (!_command || !_command.getChecked() || !this.text) { return html; }
            
            // Local variables for the loop
            var pos, part;
            
            // Optimizations
            var length = html.length;
            
            // Output
            var output = [];
            
            // State
            var offset = 0;
            var tags   = [];
            
            while (offset < length) {
                if (html.slice(offset, offset + 1) === "<") {
                    // Tag mode
                    
                    // Look for the end of the tag
                    pos  = html.indexOf(">", offset + 1);
                    part = html.slice(offset, pos + 1);
                    
                    // Update the state
                    offset = pos + 1;
                    if (part.slice(1, 2) === "/") {
                        tags.pop();
                    } else {
                        tags.push(part);
                    }
                    
                    if (part === CM_TAB) { part = TAB; }
                } else {
                    // Text mode
                    
                    // Look for the start of a tag
                    pos = html.indexOf("<", offset);
                    // The entire rest of the string is escaped text
                    if (pos === -1) { pos = length + 1; }
                    part = html.slice(offset, pos);
                    
                    // Update the state
                    offset = pos;
                    
                    // Leave the spaces in tabs as they are
                    if (tags[tags.length - 1] !== CM_TAB) {
                        // Mark the spaces appropriately
                        part = part.replace(/ /g, SPACE + " " + TAG_CLOSE);
                    }
                }
                
                // No need to handle empty strings
                if (part !== "") {
                    // Add the part to the output
                    output.push(part);
                }
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

    function refreshCodeMirror() {
        var fullEditor = EditorManager.getCurrentFullEditor();
        if (!fullEditor || !fullEditor._codeMirror) { return; }

        if (_useLegacyVersion) {
            if (_command.getChecked()) {
                patchCodeMirror(fullEditor._codeMirror);
            } else {
                unpatchCodeMirror();
            }
            
            fullEditor._codeMirror.refresh();
            $.each(EditorManager.getInlineEditors(fullEditor), function (index, inlineEditor) {
                inlineEditor._codeMirror.refresh();
            });
        } else {
            fullEditor._codeMirror.removeOverlay(overlay);
            if (_command.getChecked()) {
                fullEditor._codeMirror.addOverlay(overlay);
            }
        }
    }
    
    // --- Event Handlers ---

    function onCommandExecuted() {
        if (!_command.getChecked()) {
            _command.setChecked(true);
        } else {
            _command.setChecked(false);
        }
    }

    function onCheckedStateChange() {
        _preferences.setValue("checked", Boolean(_command.getChecked()));
        refreshCodeMirror();
    }

    // --- Loaders and Unloaders ---

    function loadPreferences() {
        _preferences = PreferencesManager.getPreferenceStorage(preferencesId, defaultPreferences);
    }


    function loadStyle() {
        ExtensionUtils.loadStyleSheet(module, "main.less").done(function (node) {
            _styleTag = node;
        });
    }

    function unloadStyle() {
        $(_styleTag).remove();
    }

    
    function loadCommand() {
        _command = CommandManager.get(commandId);
        
        if (!_command) {
            _command = CommandManager.register("Show Whitespace", commandId, onCommandExecuted);
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
        Menus.getMenu("view-menu").removeMenuItem(commandId);
    }
    
    
    function loadDocumentSync() {
        $(DocumentManager).on("currentDocumentChange", refreshCodeMirror);
    }

    function unloadDocumentSync() {
        $(DocumentManager).off("currentDocumentChange", refreshCodeMirror);
    }

    
    // Setup the UI
    function load() {
        loadPreferences();
        loadStyle();
        loadCommand();
        loadMenuItem();
        loadDocumentSync();
    }

    // Tear down the UI
    function unload() {
        unloadDocumentSync();
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