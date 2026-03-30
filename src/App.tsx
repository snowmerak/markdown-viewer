import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BookOpen, Monitor, Upload, FileText, File as FileIcon, ArrowLeft } from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import './index.css';

function App() {
  const [markdown, setMarkdown] = useState<string>('');
  const [currentFile, setCurrentFile] = useState<string>('');
  const [currentFilePath, setCurrentFilePath] = useState<string>('');
  const [history, setHistory] = useState<string[]>([]);
  const [tempDir, setTempDir] = useState<string | null>(null);
  const [pendingJump, setPendingJump] = useState<'end' | null>(null);
  const [viewMode, setViewMode] = useState<'single' | 'dual'>('dual');
  const [currentScreen, setCurrentScreen] = useState<number>(0);
  const [totalScreens, setTotalScreens] = useState<number>(1);
  const viewerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const cleanTempDir = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (typeof nw !== 'undefined' && tempDir) {
       try {
         // eslint-disable-next-line @typescript-eslint/no-require-imports
         const fs = require('fs');
         fs.rmSync(tempDir, { recursive: true, force: true });
       } catch (e) {
         console.error('Failed to clean temp dir', e);
       }
    }
  }, [tempDir]);

  useEffect(() => {
     return () => cleanTempDir();
  }, [cleanTempDir]);

  // Parse Markdown to sanitized HTML
  const getHtml = () => {
    if (!markdown) return { __html: '' };
    try {
      // 1. Convert [[link]] or ![[link]] to markdown links
      const preProcessed = markdown.replace(/!?\[\[([^\]]+)\]\]/g, (_match, p1) => {
        const target = p1.toLowerCase().endsWith('.md') ? p1 : `${p1}.md`;
        return `[${p1}](${target})`;
      });

      // Force anything into standard text layout if markdown parsing completely bombs
      const rawHtml = marked(preProcessed) as string;
      const cleanHtml = DOMPurify.sanitize(rawHtml);
      return { __html: cleanHtml || `<pre>${DOMPurify.sanitize(markdown)}</pre>` };
    } catch (e) {
      console.error(e);
      return { __html: `<pre>${DOMPurify.sanitize(markdown)}</pre>` };
    }
  };

  // Recalculate total screens when content or view mode changes
  const updatePaginationMetrics = useCallback(() => {
    if (viewerRef.current && containerRef.current) {
      const totalWidth = viewerRef.current.scrollWidth;
      const screenWidth = window.innerWidth;
      const calcScreens = Math.ceil(totalWidth / screenWidth);
      setTotalScreens(Math.max(1, calcScreens));
    }
  }, []);

  useEffect(() => {
    if (markdown) {
      setTimeout(() => {
        updatePaginationMetrics();
        setCurrentScreen(prev => {
          if (pendingJump === 'end') {
            setPendingJump(null);
            if (viewerRef.current) {
              const calcScreens = Math.ceil(viewerRef.current.scrollWidth / window.innerWidth);
              return Math.max(0, calcScreens - 1);
            }
          }
          return prev;
        });
      }, 50);
    }
    window.addEventListener('resize', updatePaginationMetrics);
    return () => window.removeEventListener('resize', updatePaginationMetrics);
  }, [markdown, viewMode, updatePaginationMetrics, pendingJump]);

  // Handle Keydown specific to pagination
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!markdown) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        if (currentScreen >= totalScreens - 1 && history.length > 0) {
          if (confirm("End of document. Return to previous page?")) {
            goBack();
          }
        } else {
          setCurrentScreen(prev => Math.min(prev + 1, totalScreens - 1));
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        setCurrentScreen(prev => Math.max(prev - 1, 0));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [markdown, totalScreens, currentScreen, history]);

  const goBack = () => {
    if (history.length > 0) {
      const prev = history[history.length - 1];
      setHistory(prevHistory => prevHistory.slice(0, -1));
      readFileByPath(prev, true);
    }
  };

  // Handle Single File Reading
  const readFileByPath = async (filePath: string, isBacking: boolean = false, fromPath?: string) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (typeof nw !== 'undefined') {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const fs = require('fs');
        const data = await fs.promises.readFile(filePath, 'utf8');
        
        if (fromPath && !isBacking) {
            setHistory(prev => [...prev, fromPath]);
        }
        
        setCurrentFile(filePath.split(/[\\/]/).pop() || 'Unknown File');
        setCurrentFilePath(filePath);
        setMarkdown(data);
        if (isBacking) setPendingJump('end');
        else setCurrentScreen(0);
      } catch (e) {
        console.error("NW.js FS read failed", e);
        alert(`Failed to read file: ${e}`);
      }
    }
  };

  const handleZipDrop = async (zipPath: string) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (typeof nw !== 'undefined') {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const AdmZip = require('adm-zip');
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const os = require('os');
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const path = require('path');
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const fs = require('fs');
        
        setMarkdown('Loading ZIP...');
        // allow React to render loading
        await new Promise(r => setTimeout(r, 50));
        
        const zip = new AdmZip(zipPath);
        const extractPath = path.join(os.tmpdir(), `mdv_${Date.now()}`);
        setTempDir(extractPath);
        
        zip.extractAllTo(extractPath, true);
        
        // Find index.md or README.md or the first md file
        const files = fs.readdirSync(extractPath);
        let entryPoint = files.find((f: string) => f.toLowerCase() === 'index.md' || f.toLowerCase() === 'readme.md');
        if (!entryPoint) {
            entryPoint = files.find((f: string) => f.toLowerCase().endsWith('.md'));
        }
        
        if (entryPoint) {
           setHistory([]); // clear history
           readFileByPath(path.join(extractPath, entryPoint));
        } else {
           setMarkdown('');
           alert("No .md file found in ZIP.");
        }
      } catch (e) {
         setMarkdown('');
         console.error("Zip extraction failed", e);
         alert("Failed to extract zip.");
      }
    }
  };

  // Core Entry Point for File Selection
  const handleSystemPath = async (fileObj: File) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (typeof nw !== 'undefined') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const path = (fileObj as any).path;
      if (!path) return fallbackBrowserRead(fileObj);

      try {
        if (path.toLowerCase().endsWith('.zip')) {
           cleanTempDir(); // Clean previous if exists
           await handleZipDrop(path);
           return;
        }

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const fs = require('fs');
        const stats = await fs.promises.stat(path);

        if (stats.isDirectory()) {
          alert("Folders are not supported. Please drop a file.");
          return;
        } else {
          setHistory([]); // Fresh open, reset history
          await readFileByPath(path);
        }
      } catch (e) {
        console.error("Path handling failed", e);
        fallbackBrowserRead(fileObj);
      }
    } else {
      fallbackBrowserRead(fileObj);
    }
  };

  const fallbackBrowserRead = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setCurrentFile(file.name);
      setMarkdown(e.target?.result as string);
      setCurrentScreen(0);
    };
    reader.readAsText(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleSystemPath(file);
  };

  // 1. Landing View
  if (!markdown) {
    return (
      <div 
        className="landing"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        <h1>Antigravity Reader</h1>
        <p>Drop any file to read.</p>
        <div 
          className="drop-zone"
          style={{ width: '100%', maxWidth: '500px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
        >
          <Upload size={48} color="#8b949e" style={{ marginBottom: '16px' }} />
          <span style={{ fontSize: '1.2rem', marginBottom: '32px' }}>Drag & drop any <strong style={{ color: '#58a6ff' }}>File</strong></span>
          
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', width: '100%' }}>
            <label className="btn" style={{ flex: 1, justifyContent: 'center', padding: '12px 0' }}>
              <FileIcon size={18} /> Browse File
              <input type="file" style={{ display: 'none' }} onChange={(e) => { if(e.target.files?.[0]) handleSystemPath(e.target.files[0]); }} />
            </label>
          </div>
        </div>
      </div>
    );
  }

  // 2. Document Viewer
  return (
    <div className="app-root" style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* UI Controls overlay */}
      <div className="ui-overlay">
        <button className="btn" onClick={() => { setMarkdown(''); setCurrentFile(''); setCurrentFilePath(''); setHistory([]); cleanTempDir(); }}>
          <FileText size={16} /> Close
        </button>
        {history.length > 0 && (
          <button className="btn" onClick={goBack}>
            <ArrowLeft size={16} /> Back
          </button>
        )}
        <div style={{ fontSize: '0.875rem', padding: '4px 16px', background: 'rgba(0,0,0,0.4)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)', margin: '0 8px', display: 'flex', alignItems: 'center' }}>
          {currentFile}
        </div>
        <button 
          className="btn" 
          onClick={() => {
            setViewMode('single');
            setCurrentScreen(0);
          }}
          title="Single Page View"
          style={{ background: viewMode === 'single' ? 'rgba(88, 166, 255, 0.2)' : '' }}
        >
          <Monitor size={16} />
        </button>
        <button 
          className="btn" 
          onClick={() => {
            setViewMode('dual');
            setCurrentScreen(0);
          }}
          title="Dual Page View"
          style={{ background: viewMode === 'dual' ? 'rgba(88, 166, 255, 0.2)' : '' }}
        >
          <BookOpen size={16} />
        </button>
      </div>

      {/* Pagination Container - Slides left and right cleanly */}
      <div 
        className="transform-wrapper"
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          transform: `translateX(-${currentScreen * 100}%)`,
          transition: 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)',
          willChange: 'transform'
        }}
      >
        {/* CSS Multi-column rendering engine */}
        <div 
          className={`viewer-container ${viewMode} markdown-body`}
          ref={viewerRef}
          onClick={(e) => {
            const target = (e.target as HTMLElement).closest('a');
            if (!target) return;
            const href = target.getAttribute('href');
            if (href && !href.startsWith('http') && !href.startsWith('#')) {
              e.preventDefault();
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              if (typeof nw !== 'undefined' && currentFilePath) {
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                const path = require('path');
                const nextPath = path.resolve(path.dirname(currentFilePath), href);
                readFileByPath(nextPath, false, currentFilePath);
              }
            }
          }}
          dangerouslySetInnerHTML={getHtml()}
        />
      </div>

      {/* Page / Screen Indicator */}
      <div className="page-indicator">
        {currentScreen + 1} / {totalScreens}
      </div>
    </div>
  );
}

export default App;
