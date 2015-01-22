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
/*global define, $, brackets */

define(function (require, exports, module) {
    "use strict";
    
    
    // --- Required modules ---

    var CommandManager     = brackets.getModule("command/CommandManager");
    var EditorManager      = brackets.getModule("editor/EditorManager");
    var ExtensionUtils     = brackets.getModule("utils/ExtensionUtils");
    var Menus              = brackets.getModule("command/Menus");
    var PreferencesManager = brackets.getModule("preferences/PreferencesManager");
    var CodeMirror = brackets.getModule("thirdparty/CodeMirror2/lib/codemirror");

    
    // --- Settings ---
    
    var commandId          = "denniskehrig.ShowWhitespace.toggle";
    var preferencesId      = "denniskehrig.ShowWhitespace";
    var defaultPreferences = { checked: true };

    
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
            _isEmptyLine    = false,
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
                    _isEmptyLine = false;
                    
                    _trailingOffset = stream.string.length;
                    trailing = stream.string.match(/[ \t]+$/);
                    if (trailing) {
                        _trailingOffset -= trailing[0].length;
                        // Everything is whitespace
                        if (_trailingOffset === 0) {
                            _isEmptyLine = true;
                        }
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
                        tokenStyle  += (_isEmptyLine ? "empty-line-" : (_isLeading ? "leading-" : (_isTrailing ? "trailing-" : "")));
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
    
    function updateEditors(includeEditor) {
        var fullEditor = EditorManager.getCurrentFullEditor();
        if (!fullEditor) { return; }
        
        var editors = [fullEditor].concat(EditorManager.getInlineEditors(fullEditor));
        
        // activeEditorChange fires before a just opened inline editor would be listed by getInlineEditors
        // So we include it manually
        if (includeEditor && editors.indexOf(includeEditor) === -1) {
            editors.push(includeEditor);
        }
        
        editors.forEach(updateEditorViaOverlay);
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
        _preferences.set("checked", Boolean(_command.getChecked()));
        updateEditors();
    }
    
    function onActiveEditorChange(e, editor) {
        updateEditors(editor);
    }

    
    // --- Loaders and Unloaders ---

    function loadPreferences() {
        _preferences = PreferencesManager.getExtensionPrefs(preferencesId);
        _preferences.definePreference("checked", "boolean", defaultPreferences["checked"]);
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

        _command.on("checkedStateChange", onCheckedStateChange);
        
        // Apply preferences
        _command.setChecked(_preferences.get("checked"));
    }

    function unloadCommand() {
        _command.setChecked(false);
        _command.off("checkedStateChange", onCheckedStateChange);
        _command._commandFn = null;
    }

    
    function loadMenuItem() {
        Menus.getMenu("view-menu").addMenuItem(commandId, "Ctrl-Alt-W");
    }

    function unloadMenuItem() {
        Menus.getMenu("view-menu").removeMenuItem(commandId);
    }
    
    
    function loadEditorSync() {
        EditorManager.on("activeEditorChange", onActiveEditorChange);
    }

    function unloadEditorSync() {
        EditorManager.off("activeEditorChange", onActiveEditorChange);
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
