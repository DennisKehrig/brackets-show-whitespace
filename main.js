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
    var EditorManager      = brackets.getModule("editor/EditorManager");
    var ExtensionUtils     = brackets.getModule("utils/ExtensionUtils");
    var Menus              = brackets.getModule("command/Menus");
    var PreferencesManager = brackets.getModule("preferences/PreferencesManager");

    
    // --- Settings ---
    
    var commandId          = "denniskehrig.ShowWhitespace.toggle";
    var preferencesId      = "denniskehrig.ShowWhitespace";
    var defaultPreferences = { checked: false };

    
    // --- State Variables ---
    
    var _preferences,
        _command,
        _styleTag,
        _Line,
        _LineGetHTML;

    
    // --- Functionality ---

    /**
     * Create a new overlay mode that encapsulates its own state in a closure.
     * Such a mode can only be used once at a time because the shared state would create conflicts otherwise.
     */
    function _makeOverlay() {
        // States for the overlay mode, which is supposed to be stateless and so can't use the state functionality provided by CodeMirror
        var _appendSpace    = false,
            _isLeading      = true,
            _isTrailing     = false,
            _trailingOffset = null;
        
        return {
            token: function (stream, state) {
                var ch,
                    trailing,
                    ateCode     = false,
                    tokenStyle  = "";
                
                // Start of line: reset state
                if (stream.sol()) {
                    _isLeading  = true;
                    _isTrailing = false;
                    
                    _trailingOffset = stream.string.length;
                    trailing = stream.string.match(/[ \t]+$/);
                    if (trailing) {
                        _trailingOffset -= trailing[0].length;
                    }
                }
                
                // Peek ahead one character at a time
                // Wrapping the assignment in a Boolean makes JSLint happy
                while (Boolean(ch = stream.peek())) {
                    if (ch === " " || ch === "\t") {
                        if (ateCode) {
                            // Return now to mark all code seen so far as not necessary to highlight
                            return null;
                        }
                        // Eat the whitespace
                        stream.next();
                        
                        // Test if this is a trailing whitespace
                        if (!_isLeading && !_isTrailing) {
                            _isTrailing = stream.pos >= _trailingOffset;
                        }
                        
                        // CodeMirror merges consecutive tokens with the same style
                        // There's a setting called "flattenSpans" to prevent that, but it's for the whole editor*
                        // So instead we simply append a space character to the style every other time
                        // This disables CodeMirror's string comparison while having no effect on the CSS class
                        // *changed in https://github.com/marijnh/CodeMirror/commit/221a1e4070d503f4597f7823e4f2cf68ba884cdf
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
    }
        
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
    
    function updateEditorViaOverlay(editor) {
        var codeMirror = editor._codeMirror;
        if (!codeMirror) { return; }
        
        var showWhitespace = _command.getChecked();
        
        if (!showWhitespace && codeMirror._dkShowWhitespaceOverlay) {
            codeMirror.removeOverlay(codeMirror._dkShowWhitespaceOverlay);
            delete codeMirror._dkShowWhitespaceOverlay;
        }
        
        if (showWhitespace && !codeMirror._dkShowWhitespaceOverlay) {
            codeMirror._dkShowWhitespaceOverlay = _makeOverlay();
            codeMirror.addOverlay(codeMirror._dkShowWhitespaceOverlay);
        }
    }
    
    // CodeMirror 2 version
    function updateEditorViaPatch(editor) {
        var codeMirror = editor._codeMirror;
        if (!codeMirror) { return; }
        
        if (_command.getChecked()) {
            patchCodeMirror(codeMirror);
        } else {
            unpatchCodeMirror();
        }
        codeMirror.refresh();
    }
    
    function updateEditors(includeEditor) {
        var fullEditor = EditorManager.getCurrentFullEditor();
        if (!fullEditor) { return; }
        
        var editors = [fullEditor].concat(EditorManager.getInlineEditors(fullEditor));
        
        // activeEditorChange fires before a just opened inline editor would be listed by getInlineEditors
        // So we include it manually
        if (includeEditor && editors.indexOf(includeEditor) === -1) {
            editors.push(includeEditor);
        }
        
        // CodeMirror 2 doesn't set a version and doesn't feature addOverlay yet, so we use a different strategy
        editors.forEach(CodeMirror.version ? updateEditorViaOverlay : updateEditorViaPatch);
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
        updateEditors();
    }
    
    function onActiveEditorChange(e, editor) {
        updateEditors(editor);
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
    
    
    function loadEditorSync() {
        $(EditorManager).on("activeEditorChange", onActiveEditorChange);
    }

    function unloadEditorSync() {
        $(EditorManager).off("activeEditorChange", onActiveEditorChange);
    }

    
    // Setup the UI
    function load() {
        loadPreferences();
        loadStyle();
        loadCommand();
        loadMenuItem();
        loadEditorSync();
    }

    // Tear down the UI
    function unload() {
        unloadEditorSync();
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