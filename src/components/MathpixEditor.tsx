'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MathpixMarkdownModel as MM } from 'mathpix-markdown-it';

interface MathpixEditorProps {
  mmdFilePath?: string;
  initialContent?: string;
  onSave?: (updatedContent: string) => void;
}

interface TextSelection {
  text: string;
  start: number;
  end: number;
  range?: Range;
}

interface HistoryState {
  content: string;
  timestamp: number;
}

interface ChatMessage {
  id: string;
  type: 'user' | 'ai' | 'system';
  content: string;
  timestamp: number;
}

interface AIEdit {
  originalText: string;
  editedText: string;
  prompt: string;
  timestamp: number;
  selectionStart?: number;
  selectionEnd?: number;
  fullModifiedContent?: string;
}


const DiffPanel = React.memo(({ html, type }: { html: string; type: 'before' | 'after' }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [renderKey] = useState(() => `${type}-${Date.now()}-${Math.random()}`);

  useEffect(() => {
    if (ref.current && html) {
      // Clear and render only once
      ref.current.innerHTML = '';
      ref.current.innerHTML = html;
      console.log(`✅ ${type} panel rendered (key: ${renderKey})`);
    }
  }, [html, type, renderKey]);

  return (
    <div 
      ref={ref}
      className="diff-rendered"
      data-type={type}
      data-key={renderKey}
    />
  );
});

DiffPanel.displayName = 'DiffPanel';

const MathpixEditor: React.FC<MathpixEditorProps> = ({ mmdFilePath, initialContent = '', onSave }) => {
  const [originalContent, setOriginalContent] = useState(initialContent);
  const [selectedText, setSelectedText] = useState<TextSelection | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // AI Chat features
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [pendingAIEdit, setPendingAIEdit] = useState<AIEdit | null>(null);
  const [showAIDiff, setShowAIDiff] = useState(false);
  
  // History and Persistence
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Debounced diff rendering to prevent duplicates
  const [diffBeforeHtml, setDiffBeforeHtml] = useState<string>('');
  const [diffAfterHtml, setDiffAfterHtml] = useState<string>('');
  const [renderingDiff, setRenderingDiff] = useState(false);
  
  const previewRef = useRef<HTMLDivElement>(null);
  const selectedPreviewRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const renderTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const storageKey = `mathpix-editor-state-${mmdFilePath || 'default'}`;

  //  Debounced diff rendering function
  const renderDiffContent = useCallback(async (aiEdit: AIEdit) => {
    if (renderTimeoutRef.current) {
      clearTimeout(renderTimeoutRef.current);
    }

    setRenderingDiff(true);
    console.log('🎨 Starting diff render for:', aiEdit.timestamp);

    renderTimeoutRef.current = setTimeout(async () => {
      try {
        // Clear existing content first
        setDiffBeforeHtml('');
        setDiffAfterHtml('');
        
        // Small delay to ensure clearing
        await new Promise(resolve => setTimeout(resolve, 10));
        
        // Render new content
        const beforeHtml = MM.render(aiEdit.originalText);
        const afterHtml = MM.render(aiEdit.editedText);
        
        console.log('✅ Diff content rendered successfully');
        setDiffBeforeHtml(beforeHtml);
        setDiffAfterHtml(afterHtml);
        
      } catch (error) {
        console.error('❌ Diff rendering error:', error);
        setDiffBeforeHtml(`<pre style="color: #666;">${aiEdit.originalText}</pre>`);
        setDiffAfterHtml(`<pre style="color: #666;">${aiEdit.editedText}</pre>`);
      } finally {
        setRenderingDiff(false);
      }
    }, 100);
  }, []);


  const diffDisplay = useMemo(() => {
    if (!pendingAIEdit || !showAIDiff) return null;

    return (
      <div className="diff-display" key={pendingAIEdit.timestamp}>
        <div className="diff-section">
          <h4><b>Before:</b></h4>
          {renderingDiff ? (
            <div className="diff-loading">Rendering...</div>
          ) : (
            <DiffPanel 
              html={diffBeforeHtml} 
              type="before" 
              key={`before-${pendingAIEdit.timestamp}`}
            />
          )}
        </div>
        <div className="diff-section">
          <h4><b>After:</b></h4>
          {renderingDiff ? (
            <div className="diff-loading">Rendering...</div>
          ) : (
            <DiffPanel 
              html={diffAfterHtml} 
              type="after" 
              key={`after-${pendingAIEdit.timestamp}`}
            />
          )}
        </div>
      </div>
    );
  }, [pendingAIEdit, showAIDiff, diffBeforeHtml, diffAfterHtml, renderingDiff]);

  // Load persisted state on mount
  useEffect(() => {
    if (isInitialized) return;

    const loadPersistedState = () => {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          console.log('🔄 Loading persisted state');
          
          if (parsed.content && typeof parsed.content === 'string') {
            setOriginalContent(parsed.content);
          }
          
          if (parsed.history && Array.isArray(parsed.history) && parsed.history.length > 0) {
            setHistory(parsed.history);
            const validIndex = parsed.historyIndex >= 0 && parsed.historyIndex < parsed.history.length 
              ? parsed.historyIndex 
              : parsed.history.length - 1;
            setHistoryIndex(validIndex);
          }
          
          if (parsed.chatMessages && Array.isArray(parsed.chatMessages)) {
            setChatMessages(parsed.chatMessages);
          }
          
          if (parsed.pendingAIEdit) {
            setPendingAIEdit(parsed.pendingAIEdit);
            setShowAIDiff(parsed.showAIDiff || false);
          }
          
          console.log('✅ State restored successfully');
          return true;
        }
      } catch (err) {
        console.warn('Failed to load persisted state:', err);
        localStorage.removeItem(storageKey);
      }
      return false;
    };

    if (mmdFilePath) {
      const hasPersisted = loadPersistedState();
      if (!hasPersisted) {
        loadMmdFile(mmdFilePath);
      }
    } else if (initialContent) {
      if (!loadPersistedState()) {
        setOriginalContent(initialContent);
        const initialState = { content: initialContent, timestamp: Date.now() };
        setHistory([initialState]);
        setHistoryIndex(0);
      }
    } else {
      loadPersistedState();
    }

    setIsInitialized(true);
  }, [mmdFilePath, initialContent, storageKey, isInitialized]);

  // Save state to localStorage
  useEffect(() => {
    if (!isInitialized) return;

    if (originalContent || history.length > 0 || chatMessages.length > 0) {
      const stateToSave = {
        content: originalContent,
        history,
        historyIndex,
        chatMessages,
        pendingAIEdit,
        showAIDiff,
        lastSaved: Date.now(),
        version: '1.0'
      };
      
      try {
        localStorage.setItem(storageKey, JSON.stringify(stateToSave));
        console.log('💾 State persisted');
      } catch (err) {
        console.warn('Failed to save state:', err);
      }
    }
  }, [originalContent, history, historyIndex, chatMessages, pendingAIEdit, showAIDiff, storageKey, isInitialized]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  // Render selected text
  useEffect(() => {
    if (selectedText && selectedPreviewRef.current) {
      renderSelectedText();
    } else if (selectedPreviewRef.current) {
      selectedPreviewRef.current.innerHTML = '';
    }
  }, [selectedText]);


  useEffect(() => {
    if (pendingAIEdit && showAIDiff) {
      console.log('🔄 Triggering diff render for:', pendingAIEdit.timestamp);
      renderDiffContent(pendingAIEdit);
    } else {
      // Clear diff content
      setDiffBeforeHtml('');
      setDiffAfterHtml('');
      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current);
      }
    }

    // Cleanup
    return () => {
      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current);
      }
    };
  }, [pendingAIEdit, showAIDiff, renderDiffContent]);

  const loadMmdFile = async (filePath: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(filePath + '?t=' + Date.now(), {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to load file: ${response.statusText}`);
      }
      
      const content = await response.text();
      
      if (!content.trim()) {
        throw new Error('File appears to be empty');
      }
      
      setOriginalContent(content);
      
      const initialState = { content, timestamp: Date.now() };
      setHistory([initialState]);
      setHistoryIndex(0);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(`Error loading ${filePath}: ${errorMessage}`);
      console.error('Error loading MMD file:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize Mathpix styles
  useEffect(() => {
    const initializeMathpixStyles = () => {
      const elStyle = document.getElementById('Mathpix-styles');
      if (!elStyle) {
        const style = document.createElement("style");
        style.setAttribute("id", "Mathpix-styles");
        style.innerHTML = MM.getMathpixFontsStyle() + MM.getMathpixStyle(true);
        document.head.appendChild(style);
      }
    };

    initializeMathpixStyles();
  }, []);

  useEffect(() => {
    if (previewRef.current && originalContent) {
      renderMathpixMarkdown();
    }
  }, [originalContent]);

  const renderMathpixMarkdown = async () => {
    if (!previewRef.current) return;

    setIsRendering(true);

    try {
      const html = MM.render(originalContent);
      previewRef.current.innerHTML = html;
    } catch (error) {
      console.error('Mathpix Markdown rendering error:', error);
      if (previewRef.current) {
        previewRef.current.innerHTML = `<pre style="color: #dc3545;">Error rendering content: ${error}</pre>`;
      }
    } finally {
      setIsRendering(false);
    }
  };

  const renderSelectedText = async () => {
    if (!selectedText || !selectedPreviewRef.current) return;

    try {
      const html = MM.render(selectedText.text);
      selectedPreviewRef.current.innerHTML = html;
    } catch (error) {
      console.error('Selected text rendering error:', error);
      if (selectedPreviewRef.current) {
        selectedPreviewRef.current.innerHTML = `<pre>${selectedText.text}</pre>`;
      }
    }
  };

  const findTextInOriginal = (selectedText: string) => {
    let start = originalContent.indexOf(selectedText);
    if (start !== -1) {
      return {
        text: selectedText,
        start,
        end: start + selectedText.length
      };
    }
    
    const normalizedSelected = selectedText.replace(/\s+/g, ' ').trim();
    const normalizedOriginal = originalContent.replace(/\s+/g, ' ');
    
    start = normalizedOriginal.indexOf(normalizedSelected);
    if (start !== -1) {
      let originalPos = 0;
      let normalizedPos = 0;
      
      while (normalizedPos < start && originalPos < originalContent.length) {
        if (/\s/.test(originalContent[originalPos])) {
          while (originalPos < originalContent.length && /\s/.test(originalContent[originalPos])) {
            originalPos++;
          }
          if (normalizedPos < normalizedOriginal.length && normalizedOriginal[normalizedPos] === ' ') {
            normalizedPos++;
          }
        } else {
          originalPos++;
          normalizedPos++;
        }
      }
      
      const searchStart = Math.max(0, originalPos - 100);
      const searchEnd = Math.min(originalContent.length, originalPos + selectedText.length + 100);
      const searchArea = originalContent.substring(searchStart, searchEnd);
      const localStart = searchArea.indexOf(selectedText);
      
      if (localStart !== -1) {
        const actualStart = searchStart + localStart;
        return {
          text: selectedText,
          start: actualStart,
          end: actualStart + selectedText.length
        };
      }
    }
    
    const words = selectedText.split(/\s+/).filter(w => w.length > 2);
    if (words.length > 0) {
      const firstWord = words[0];
      const lastWord = words[words.length - 1];
      
      const startPos = originalContent.indexOf(firstWord);
      if (startPos !== -1) {
        const endSearch = originalContent.indexOf(lastWord, startPos);
        if (endSearch !== -1) {
          const endPos = endSearch + lastWord.length;
          const extractedText = originalContent.substring(startPos, endPos);
          
          return {
            text: extractedText,
            start: startPos,
            end: endPos
          };
        }
      }
    }
    
    return null;
  };

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const selectedText = selection.toString().trim();
    
    if (selectedText === '') {
      setSelectedText(null);
      return;
    }

    try {
      const selectedInOriginal = findTextInOriginal(selectedText);
      
      if (selectedInOriginal) {
        setSelectedText({
          text: selectedInOriginal.text,
          start: selectedInOriginal.start,
          end: selectedInOriginal.end,
          range: selection.getRangeAt(0).cloneRange()
        });
      }
    } catch (error) {
      console.error('Selection error:', error);
    }
  };

  const scrollToChangedSection = (selectionStart: number, smooth = true) => {
    if (!previewRef.current) return;

    if (smooth) {
      previewRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      previewRef.current.scrollTop = 0;
    }
  };

  const addToHistory = (content: string) => {
    const newState = { content, timestamp: Date.now() };
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newState);
    
    if (newHistory.length > 50) {
      newHistory.shift();
    }
    
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setOriginalContent(history[newIndex].content);
      addChatMessage('system', 'Undid last change');
      
      setTimeout(() => scrollToChangedSection(0), 100);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setOriginalContent(history[newIndex].content);
      addChatMessage('system', 'Redid change');
      
      setTimeout(() => scrollToChangedSection(0), 100);
    }
  };

  const addChatMessage = (type: 'user' | 'ai' | 'system', content: string) => {
    const message: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      content,
      timestamp: Date.now()
    };
    setChatMessages(prev => [...prev, message]);
  };

  const handleAIRequest = async () => {
    if (!chatInput.trim()) return;

    const userPrompt = chatInput.trim();
    setChatInput('');
    setIsAIProcessing(true);
    
    addChatMessage('user', userPrompt);

    try {
      const response = await fetch('/api/ai-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userPrompt,
          selectedText: selectedText?.text || null,
          fullContent: originalContent
        })
      });

      const data = await response.json();

      if (data.success) {
        const editedText = data.editedText;
        
        if (editedText.startsWith('ERROR:')) {
          addChatMessage('ai', editedText);
        } else {
          let fullModifiedContent;
          if (selectedText) {
            fullModifiedContent = 
              originalContent.substring(0, selectedText.start) +
              editedText +
              originalContent.substring(selectedText.end);
          } else {
            fullModifiedContent = editedText;
          }

          const newAIEdit = {
            originalText: selectedText?.text || originalContent,
            editedText,
            prompt: userPrompt,
            timestamp: Date.now(),
            selectionStart: selectedText?.start,
            selectionEnd: selectedText?.end,
            fullModifiedContent
          };

          setPendingAIEdit(newAIEdit);
          setShowAIDiff(true);
          addChatMessage('ai', `I've prepared an edit for: "${userPrompt}". Review the changes in the diff panel.`);
        }
      } else {
        addChatMessage('ai', 'Sorry, I encountered an error processing your request.');
      }
    } catch (error) {
      console.error('AI request failed:', error);
      addChatMessage('ai', 'Failed to connect to AI service. Please try again.');
    } finally {
      setIsAIProcessing(false);
    }
  };

  const acceptAIEdit = () => {
    if (!pendingAIEdit || !pendingAIEdit.fullModifiedContent) return;

    const newContent = pendingAIEdit.fullModifiedContent;
    const changeStart = pendingAIEdit.selectionStart || 0;

    addToHistory(newContent);
    setOriginalContent(newContent);
    setPendingAIEdit(null);
    setShowAIDiff(false);
    setSelectedText(null);
    
    addChatMessage('system', 'Applied AI edit successfully');
    
    if (onSave) {
      onSave(newContent);
    }

    setTimeout(() => scrollToChangedSection(changeStart), 100);
  };

  const discardAIEdit = () => {
    setPendingAIEdit(null);
    setShowAIDiff(false);
    setSelectedText(null);
    addChatMessage('system', 'Discarded AI edit');
  };

  const handleReloadFile = async () => {
    if (!mmdFilePath) {
      console.warn('No file path available to reload');
      addChatMessage('system', 'Error: No file path available for reloading');
      return;
    }

    const hasUnsavedChanges = historyIndex > 0 || showAIDiff;
    if (hasUnsavedChanges) {
      const confirmReload = window.confirm(
        '⚠️ You have unsaved changes. Reloading will discard all changes and chat history. Continue?'
      );
      if (!confirmReload) {
        return;
      }
    }

    localStorage.removeItem(storageKey);
    
    setSelectedText(null);
    setPendingAIEdit(null);
    setShowAIDiff(false);
    setChatMessages([]);
    setHistory([]);
    setHistoryIndex(-1);
    
    await loadMmdFile(mmdFilePath);
    
    addChatMessage('system', '✅ File reloaded successfully! All changes and history cleared.');
    
    setTimeout(() => scrollToChangedSection(0), 100);
  };

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">Loading {mmdFilePath}...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="error-message">
          <h3>Error</h3>
          <p>{error}</p>
          <button onClick={handleReloadFile} className="retry-btn">
            Retry Loading
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mathpix-editor">
      <div className="editor-container">
        {/* Left Panel */}
        <div className={`left-panel ${showAIDiff || selectedText ? 'with-diff' : 'full-width'}`}>
          <div className="panel-header">
            <h3>Document Preview</h3>
            <div className="header-actions">
              <button 
                onClick={undo} 
                disabled={historyIndex <= 0}
                className="history-btn"
                title="Undo"
              >
                ↶
              </button>
              <button 
                onClick={redo} 
                disabled={historyIndex >= history.length - 1}
                className="history-btn"
                title="Redo"
              >
                ↷
              </button>
              {mmdFilePath && (
                <div className="file-info">
                  <span className="file-name">{mmdFilePath}</span>
                  <button onClick={handleReloadFile} className="reload-btn">
                    ↻
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="content-container">
            <div className="preview-section">
              {isRendering && <div className="loading">Rendering...</div>}
              <div 
                ref={previewRef} 
                className="preview-container"
                onMouseUp={handleTextSelection}
              ></div>
            </div>
          </div>
        </div>

        {/* Middle Panel */}
        {(selectedText || showAIDiff) && (
          <div className="middle-panel">
            {showAIDiff ? (
              <>
                <div className="sticky-actions">
                  <div className="ai-diff-header">
                    <h3>AI Proposed Edit</h3>
                    <p>"{pendingAIEdit?.prompt}"</p>
                  </div>
                  <div className="ai-diff-actions">
                    <button className="accept-btn" onClick={acceptAIEdit}>
                      ✓ Accept Changes
                    </button>
                    <button className="discard-btn" onClick={discardAIEdit}>
                      ✗ Discard
                    </button>
                  </div>
                </div>
                <div className="diff-content">
                  {diffDisplay}
                </div>
              </>
            ) : (
              <>
                <div className="sticky-actions">
                  <div className="selection-header">
                    <h3>Selected Text</h3>
                    <p>{selectedText?.text.substring(0, 50)}{selectedText && selectedText.text.length > 50 ? '...' : ''}</p>
                  </div>
                  <div className="selection-actions">
                    <button 
                      className="clear-btn" 
                      onClick={() => setSelectedText(null)}
                    >
                      ✗ Clear Selection
                    </button>
                  </div>
                </div>
                <div className="selection-content">
                  <div className="selected-text-display">
                    <h4>Selected Content (Rendered):</h4>
                    <div 
                      ref={selectedPreviewRef} 
                      className="selected-preview-rendered"
                    ></div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Right Panel */}
        <div className={`right-panel ${showAIDiff || selectedText ? 'with-diff' : 'full-width'}`}>
          <div className="panel-header">
            <h3>AI Assistant</h3>
            <div className="chat-status">
              {chatMessages.length > 0 && (
                <small className="message-count">
                  {chatMessages.length} messages
                </small>
              )}
            </div>
          </div>
          
          <div className="chat-container">
            <div className="chat-messages">
              {chatMessages.length === 0 && (
                <div className="welcome-message">
                  <div className="welcome-content">
                    <h4>👋 Welcome to AI Document Editor!</h4>
                    <p>Select text from the document and ask me to edit it, or ask me to edit the entire document.</p>
                    <div className="example-prompts">
                      <small>
                        💡 Try: "make this shorter", "add bullet points", "fix grammar", "turn into a list"
                      </small>
                    </div>
                  </div>
                </div>
              )}
              {chatMessages.map((message) => (
                <div key={message.id} className={`chat-message ${message.type}`}>
                  <div className="message-content">
                    {message.content}
                  </div>
                  <div className="message-time">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
              {isAIProcessing && (
                <div className="chat-message ai">
                  <div className="message-content">
                    <div className="typing-indicator">AI is thinking...</div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            
            <div className="chat-input-container">
              <div className="chat-input-wrapper">
                <textarea
                  className="chat-input"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAIRequest();
                    }
                  }}
                  placeholder="Ask AI to edit your document... (e.g., 'turn section 2 into a checklist', 'fix typos in highlighted text')"
                  disabled={isAIProcessing}
                  rows={3}
                />
                <button 
                  className="send-btn"
                  onClick={handleAIRequest}
                  disabled={isAIProcessing || !chatInput.trim()}
                >
                  {isAIProcessing ? '⏳' : '➤'}
                </button>
              </div>
              <div className="chat-tips">
                <small>
                  💡 Try: "make this paragraph shorter", "add bullet points", "fix grammar"
                  {selectedText && <span> • <strong>Text selected!</strong></span>}
                </small>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .mathpix-editor {
          height: 100vh;
          width: 100%;
        }

        .loading-container, .error-container {
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #f5f5f5;
        }

        .loading-spinner {
          font-size: 18px;
          color: #666;
        }

        .error-message {
          background-color: white;
          padding: 32px;
          border-radius: 8px;
          border: 1px solid #dc3545;
          text-align: center;
        }

        .error-message h3 {
          color: #dc3545;
          margin-bottom: 16px;
        }

        .retry-btn {
          margin-top: 16px;
          padding: 8px 16px;
          background-color: #007bff;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }

        .retry-btn:hover {
          background-color: #0056b3;
        }

        .editor-container {
          display: flex;
          height: 100%;
          background-color: #f5f5f5;
        }

        .left-panel {
          background-color: white;
          display: flex;
          flex-direction: column;
          border-right: 2px solid #ddd;
          transition: width 0.3s ease;
        }

        .left-panel.full-width {
          width: 70%;
        }

        .left-panel.with-diff {
          width: 40%;
        }

        .middle-panel {
          width: 30%;
          background-color: white;
          display: flex;
          flex-direction: column;
          border-right: 2px solid #ddd;
        }

        .sticky-actions {
          position: sticky;
          top: 0;
          background-color: #f8f9ff;
          border-bottom: 2px solid #007bff;
          padding: 16px;
          z-index: 10;
          flex-shrink: 0;
        }

        .ai-diff-header, .selection-header {
          margin-bottom: 12px;
        }

        .ai-diff-header h3, .selection-header h3 {
          margin: 0 0 4px 0;
          color: #007bff;
          font-size: 16px;
        }

        .ai-diff-header p, .selection-header p {
          margin: 0;
          font-style: italic;
          color: #666;
          font-size: 14px;
        }

        .ai-diff-actions, .selection-actions {
          display: flex;
          gap: 12px;
        }

        .accept-btn, .discard-btn, .clear-btn {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .accept-btn {
          background-color: #28a745;
          color: white;
        }

        .accept-btn:hover {
          background-color: #218838;
        }

        .discard-btn, .clear-btn {
          background-color: #dc3545;
          color: white;
        }

        .discard-btn:hover, .clear-btn:hover {
          background-color: #c82333;
        }

        .diff-content, .selection-content {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }

        .diff-display {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .diff-section {
          border: 1px solid #ddd;
          border-radius: 6px;
          overflow: hidden;
        }

        .diff-section h4 {
          margin: 0;
          padding: 12px 16px;
          font-size: 14px;
          font-weight: 600;
          text-transform: uppercase;
          background-color: #f8f9fa;
          border-bottom: 1px solid #ddd;
        }

        .diff-section:first-child h4 {
          background-color: #fff5f5;
          color: #721c24;
        }

        .diff-section:last-child h4 {
          background-color: #f0fff4;
          color: #155724;
        }

        .diff-rendered {
          padding: 20px;
          max-height: 350px;
          overflow-y: auto;
          font-size: 18px;
          line-height: 1.6;
        }

        .diff-section:first-child .diff-rendered {
          background-color: #fff5f5;
        }

        .diff-section:last-child .diff-rendered {
          background-color: #f0fff4;
        }

        .diff-loading {
          padding: 20px;
          text-align: center;
          color: #007bff;
          font-style: italic;
        }

        .selected-text-display h4 {
          margin: 0 0 12px 0;
          color: #333;
          font-size: 14px;
        }

        .selected-preview-rendered {
          padding: 16px;
          background-color: #f8f9fa;
          border: 1px solid #dee2e6;
          border-radius: 4px;
          font-size: 16px;
          line-height: 1.5;
          max-height: 400px;
          overflow-y: auto;
        }

        .right-panel {
          background-color: white;
          display: flex;
          flex-direction: column;
          height: 100vh;
          transition: width 0.3s ease;
        }

        .right-panel.full-width {
          width: 30%;
        }

        .right-panel.with-diff {
          width: 30%;
        }

        .panel-header {
          padding: 16px;
          background-color: #f8f9fa;
          border-bottom: 1px solid #dee2e6;
          flex-shrink: 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .panel-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: #333;
        }

        .chat-status {
          display: flex;
          align-items: center;
        }

        .message-count {
          color: #666;
          font-size: 12px;
          background-color: #e9ecef;
          padding: 2px 8px;
          border-radius: 12px;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .history-btn {
          padding: 4px 8px;
          background-color: #6c757d;
          color: white;
          border: none;
          border-radius: 3px;
          cursor: pointer;
          font-size: 16px;
        }

        .history-btn:hover:not(:disabled) {
          background-color: #5a6268;
        }

        .history-btn:disabled {
          background-color: #ccc;
          cursor: not-allowed;
        }

        .file-info {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .file-name {
          font-size: 12px;
          color: #666;
          font-family: 'Courier New', monospace;
        }

        .reload-btn {
          font-size: 12px;
          padding: 4px 8px;
          background-color: #6c757d;
          color: white;
          border: none;
          border-radius: 3px;
          cursor: pointer;
        }

        .reload-btn:hover {
          background-color: #5a6268;
        }

        .content-container {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }

        .preview-section {
          height: 100%;
        }

        .loading {
          font-size: 14px;
          color: #007bff;
          margin-bottom: 16px;
          text-align: center;
        }

        .preview-container {
          background-color: white;
          min-height: 500px;
          cursor: text;
          user-select: text;
          font-size: 16px;
          line-height: 1.6;
          scroll-behavior: smooth;
        }

        .preview-container::selection {
          background-color: #007bff;
          color: white;
        }

        .chat-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          height: calc(100vh - 80px);
        }

        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .welcome-message {
          align-self: center;
          max-width: 90%;
          padding: 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-radius: 12px;
          text-align: center;
          margin: 20px 0;
        }

        .welcome-content h4 {
          margin: 0 0 12px 0;
          font-size: 16px;
        }

        .welcome-content p {
          margin: 0 0 16px 0;
          opacity: 0.9;
          line-height: 1.4;
        }

        .example-prompts {
          background-color: rgba(255, 255, 255, 0.1);
          padding: 8px 12px;
          border-radius: 6px;
        }

        .chat-message {
          max-width: 85%;
          padding: 10px 14px;
          border-radius: 12px;
          font-size: 14px;
          line-height: 1.4;
        }

        .chat-message.user {
          align-self: flex-end;
          background-color: #007bff;
          color: white;
          border-bottom-right-radius: 4px;
        }

        .chat-message.ai {
          align-self: flex-start;
          background-color: #f8f9fa;
          border: 1px solid #e9ecef;
          border-bottom-left-radius: 4px;
        }

        .chat-message.system {
          align-self: center;
          background-color: #fff3cd;
          border: 1px solid #ffeaa7;
          color: #856404;
          font-size: 12px;
        }

        .message-content {
          margin-bottom: 4px;
        }

        .message-time {
          font-size: 10px;
          opacity: 0.7;
        }

        .typing-indicator {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .typing-indicator::after {
          content: '●●●';
          animation: typing 1.5s infinite;
        }

        @keyframes typing {
          0%, 60%, 100% { opacity: 1; }
          30% { opacity: 0.5; }
        }

        .chat-input-container {
          border-top: 1px solid #e9ecef;
          padding: 16px;
          flex-shrink: 0;
        }

        .chat-input-wrapper {
          display: flex;
          gap: 8px;
          align-items: flex-end;
        }

        .chat-input {
          flex: 1;
          padding: 10px 12px;
          border: 1px solid #ddd;
          border-radius: 8px;
          font-size: 14px;
          line-height: 1.4;
          resize: none;
          max-height: 100px;
        }

        .chat-input:focus {
          outline: none;
          border-color: #007bff;
          box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
        }

        .send-btn {
          padding: 10px 12px;
          background-color: #007bff;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 16px;
          transition: all 0.2s;
        }

        .send-btn:hover:not(:disabled) {
          background-color: #0056b3;
        }

        .send-btn:disabled {
          background-color: #ccc;
          cursor: not-allowed;
        }

        .chat-tips {
          margin-top: 8px;
          color: #666;
          text-align: center;
        }

        @media (max-width: 1200px) {
          .editor-container {
            flex-direction: column;
          }
          
          .left-panel.full-width {
            width: 100%;
            height: 70vh;
          }

          .left-panel.with-diff {
            width: 100%;
            height: 40vh;
          }
          
          .middle-panel {
            width: 100%;
            height: 30vh;
          }

          .right-panel.full-width {
            width: 100%;
            height: 30vh;
          }

          .right-panel.with-diff {
            width: 100%;
            height: 30vh;
          }

          .left-panel, .middle-panel {
            border-right: none;
            border-bottom: 2px solid #ddd;
          }

          .chat-container {
            height: calc(30vh - 80px);
          }

          .diff-rendered {
            font-size: 16px;
          }
        }
      `}</style>
    </div>
  );
};

export default MathpixEditor;
