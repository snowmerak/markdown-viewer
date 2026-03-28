import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BookOpen, Monitor, Upload, FileText, ArrowLeft, FolderOpen, File as FileIcon } from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import './index.css';

interface FileInfo {
  name: string;
  path: string;
}

function App() {
  const [markdown, setMarkdown] = useState<string>('');
  const [currentFile, setCurrentFile] = useState<string>('');
  const [viewMode, setViewMode] = useState<'single' | 'dual'>('dual');
  const [currentScreen, setCurrentScreen] = useState<number>(0);
  const [totalScreens, setTotalScreens] = useState<number>(1);
  const viewerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Folder Browsing State
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [folderFiles, setFolderFiles] = useState<FileInfo[]>([]);

  // Parse Markdown to sanitized HTML
  const getHtml = () => {
    if (!markdown) return { __html: '' };
    try {
      // Force anything into standard text layout if markdown parsing completely bombs
      const rawHtml = marked(markdown) as string;
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
      setTimeout(updatePaginationMetrics, 50);
    }
    window.addEventListener('resize', updatePaginationMetrics);
    return () => window.removeEventListener('resize', updatePaginationMetrics);
  }, [markdown, viewMode, updatePaginationMetrics]);

  // Handle Keydown specific to pagination
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!markdown) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        setCurrentScreen(prev => Math.min(prev + 1, totalScreens - 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        setCurrentScreen(prev => Math.max(prev - 1, 0));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [markdown, totalScreens]);

  // Handle Single File Reading
  const readFileByPath = async (filePath: string) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (typeof nw !== 'undefined') {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const fs = require('fs');
        const data = await fs.promises.readFile(filePath, 'utf8');
        setCurrentFile(filePath.split(/[\\/]/).pop() || 'Unknown File');
        setMarkdown(data);
        setCurrentScreen(0);
      } catch (e) {
        console.error("NW.js FS read failed", e);
        alert(`Failed to read file: ${e}`);
      }
    }
  };

  // Core Entry Point for File / Folder Selection
  const handleSystemPath = async (fileObj: File) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (typeof nw !== 'undefined') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const path = (fileObj as any).path;
      if (!path) return fallbackBrowserRead(fileObj);

      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const fs = require('fs');
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const nodePath = require('path');
        const stats = await fs.promises.stat(path);

        if (stats.isDirectory()) {
          // Read directory
          const files = await fs.promises.readdir(path);
          const markdownFiles: FileInfo[] = [];
          for (const f of files) {
            const isMd = f.toLowerCase().endsWith('.md');
            if (isMd) {
               markdownFiles.push({ name: f, path: nodePath.join(path, f) });
            }
          }
          setCurrentFolder(path);
          setFolderFiles(markdownFiles);
          setMarkdown(''); // Clear viewer if we were previously in it
        } else {
          // Read arbitrary file
          setCurrentFolder(null); // Reset folder view if tracking one
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
      setCurrentFolder(null);
    };
    reader.readAsText(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleSystemPath(file);
  };

  // 1. Landing View
  if (!markdown && !currentFolder) {
    return (
      <div 
        className="landing"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        <h1>Antigravity Reader</h1>
        <p>Drop any file to read, or drop a folder to explore sub-documents.</p>
        <label className="drop-zone">
          <Upload size={48} className="mx-auto mt-2 mb-4 text-gray-500" />
          <span style={{ fontSize: '1.2rem' }}>Drag & drop any <strong style={{ color: '#58a6ff' }}>File</strong> or <strong style={{ color: '#a371f7' }}>Folder</strong></span>
          <input 
            type="file" 
            /* Remove strict accept to allow ANY file as requested */
            onChange={(e) => { if(e.target.files?.[0]) handleSystemPath(e.target.files[0]); }} 
          />
        </label>
      </div>
    );
  }

  // 2. Folder Browsing View
  if (!markdown && currentFolder) {
    return (
      <div 
        className="folder-view"
        style={{ padding: '40px', overflowY: 'auto', height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        <div style={{ width: '100%', maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px', paddingBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <button className="btn" onClick={() => setCurrentFolder(null)}>
              <Upload size={16} /> Home
            </button>
            <h2 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px', margin: 0, color: '#c9d1d9' }}>
              <FolderOpen size={24} color="#58a6ff" />
              {currentFolder}
            </h2>
          </div>

          {folderFiles.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#8b949e', padding: '48px 0' }}>
              No markdown files (*.md, *.MD) found in this folder.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {folderFiles.map(file => (
                <div 
                  key={file.path}
                  onClick={() => readFileByPath(file.path)}
                  style={{ display: 'flex', alignItems: 'flex-start', padding: '16px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(88,166,255,0.1)'; e.currentTarget.style.borderColor = '#58a6ff'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                >
                  <div style={{ flexShrink: 0, marginRight: '12px' }}>
                     <FileIcon size={24} color="#a371f7" />
                  </div>
                  <span style={{ wordBreak: 'break-all', lineHeight: 1.2 }}>{file.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 3. Document Viewer
  return (
    <div className="app-root" style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* UI Controls overlay */}
      <div className="ui-overlay">
        {currentFolder && (
          <button className="btn" onClick={() => setMarkdown('')}>
            <ArrowLeft size={16} /> Folder
          </button>
        )}
        {!currentFolder && (
          <button className="btn" onClick={() => { setMarkdown(''); setCurrentFile(''); }}>
            <FileText size={16} /> Close
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
