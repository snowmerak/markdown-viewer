import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BookOpen, Monitor, Upload, FileText } from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import './index.css';

function App() {
  const [markdown, setMarkdown] = useState<string>('');
  const [viewMode, setViewMode] = useState<'single' | 'dual'>('dual');
  const [currentScreen, setCurrentScreen] = useState<number>(0);
  const [totalScreens, setTotalScreens] = useState<number>(1);
  const viewerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse Markdown to sanitized HTML
  const getHtml = () => {
    if (!markdown) return { __html: '' };
    const rawHtml = marked(markdown) as string;
    const cleanHtml = DOMPurify.sanitize(rawHtml);
    return { __html: cleanHtml };
  };

  // Recalculate total screens when content or view mode changes
  const updatePaginationMetrics = useCallback(() => {
    if (viewerRef.current && containerRef.current) {
      // scrollWidth gives the total theoretical width of all columns concatenated
      const totalWidth = viewerRef.current.scrollWidth;
      const screenWidth = window.innerWidth;
      const calcScreens = Math.ceil(totalWidth / screenWidth);
      setTotalScreens(Math.max(1, calcScreens));
    }
  }, []);

  useEffect(() => {
    // Wait a brief moment for the DOM and Flexbox to compute the multi-columns accurately
    setTimeout(updatePaginationMetrics, 50);
    // Bind resize event
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

  // Read File using NW.js APIs or Web APIs
  const handleFile = async (file: File | null) => {
    if (!file) return;
    
    // Check if running inside NW.js node context
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (typeof nw !== 'undefined') {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const fs = require('fs');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const path = (file as any).path;
        const data = await fs.promises.readFile(path, 'utf8');
        setMarkdown(data);
        setCurrentScreen(0);
        return;
      } catch (e) {
        console.error("NW.js FS read failed, falling back to FileReader", e);
      }
    }

    // Standard HTML5 FileReader Fallback
    const reader = new FileReader();
    reader.onload = (e) => {
      setMarkdown(e.target?.result as string);
      setCurrentScreen(0);
    };
    reader.readAsText(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.md')) {
      handleFile(file);
    } else {
      alert("Please drop a valid .md file.");
    }
  };

  // Upload UI State
  if (!markdown) {
    return (
      <div 
        className="landing"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        <h1>Antigravity Reader</h1>
        <p>A native-feeling, paginated markdown experience</p>
        <label className="drop-zone">
          <Upload size={48} className="mx-auto mt-2 mb-4 text-gray-500" />
          <span style={{ fontSize: '1.2rem' }}>Drag & drop a <strong style={{ color: '#58a6ff' }}>.md</strong> file or click to browse</span>
          <input 
            type="file" 
            accept=".md" 
            onChange={(e) => handleFile(e.target.files?.[0] || null)} 
          />
        </label>
      </div>
    );
  }

  return (
    <div className="app-root" style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* UI Controls overlay */}
      <div className="ui-overlay">
        <button className="btn" onClick={() => setMarkdown('')}>
          <FileText size={16} /> Close
        </button>
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
