import React, { useEffect, useRef, useState } from 'react';
import { Copy, Link2, MoreHorizontal, Pencil, Trash2, Tags } from 'lucide-react';

type NodeContextToolbarProps = {
  anchor: { x: number; y: number } | null;
  onDelete: () => void;
  onDuplicate: () => void;
  onRename: () => void;
  onConnect: () => void;
  onToggleQuickAttribute: () => void;
  isQuickAttributePinned: boolean;
};

const NodeContextToolbar: React.FC<NodeContextToolbarProps> = ({
  anchor,
  onDelete,
  onDuplicate,
  onRename,
  onConnect,
  onToggleQuickAttribute,
  isQuickAttributePinned
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMenuOpen) return;
    const onWindowClick = (event: MouseEvent) => {
      const target = event.target;
      if (!rootRef.current || !(target instanceof Node) || rootRef.current.contains(target)) {
        return;
      }
      setIsMenuOpen(false);
    };
    const onWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    window.addEventListener('mousedown', onWindowClick);
    window.addEventListener('keydown', onWindowKeyDown);
    return () => {
      window.removeEventListener('mousedown', onWindowClick);
      window.removeEventListener('keydown', onWindowKeyDown);
    };
  }, [isMenuOpen]);

  if (!anchor) return null;

  return (
    <div
      ref={rootRef}
      data-testid="node-context-toolbar"
      className="ff-node-toolbar"
      style={{
        left: `${anchor.x}px`,
        top: `${anchor.y}px`,
        transform: 'translate(-50%, -100%)'
      }}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="ff-node-toolbar-btn"
        title="Rename selected node"
        aria-label="Rename selected node"
        onClick={onRename}
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>

      <button
        type="button"
        className="ff-node-toolbar-btn"
        title="Duplicate selected node"
        aria-label="Duplicate selected node"
        onClick={onDuplicate}
      >
        <Copy className="h-3.5 w-3.5" />
      </button>

      <button
        type="button"
        className="ff-node-toolbar-btn"
        title="Start connection from selected node"
        aria-label="Start connection from selected node"
        onClick={onConnect}
      >
        <Link2 className="h-3.5 w-3.5" />
      </button>

      <button
        type="button"
        className="ff-node-toolbar-btn"
        title="Delete selected node"
        aria-label="Delete selected node"
        onClick={onDelete}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>

      <div className="relative">
        <button
          type="button"
          className={`ff-node-toolbar-btn ${isMenuOpen ? 'is-active' : ''}`}
          title="More node actions"
          aria-label="More node actions"
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen((prev) => !prev)}
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>

        {isMenuOpen ? (
          <div className="ff-node-toolbar-menu">
            <button
              type="button"
              className="ff-node-toolbar-menu-item"
              onClick={() => {
                onToggleQuickAttribute();
                setIsMenuOpen(false);
              }}
            >
              <Tags className="h-3.5 w-3.5" />
              {isQuickAttributePinned ? 'Hide Account Chip' : 'Show Account Chip'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default React.memo(NodeContextToolbar);
