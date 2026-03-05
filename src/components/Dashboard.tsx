'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Plus, Edit2, Trash2, X, GripVertical, Upload, FileText, Search, FolderOpen, Copy, ExternalLink, Maximize2, Minimize2, LogOut } from 'lucide-react';
import { createCategory, createPanel, deleteCategory, deletePanel, moveCategoryToPanel, createLink, updateLink, deleteLink, updateCategoryOrder, updateLinkOrder, importBookmarks, uploadPdfs, deleteLibraryItem, updateLibraryFolderOrder, updateLibraryItemOrder } from '@/app/actions';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

import { ThemeToggle } from './ThemeToggle';

type Link = {
  id: string;
  name: string;
  url: string;
  description: string | null;
  categoryId: string;
  order: number;
};

type Category = {
  id: string;
  name: string;
  panel: string;
  order: number;
  links: Link[];
};

type LibraryItem = {
  id: string;
  name: string;
  fileId: string;
  folder: string;
  order: number;
  folderOrder: number;
  viewUrl: string;
};

const CREATE_NEW_PANEL_VALUE = '__create_new_panel__';
const DEFAULT_PANELS = ['Work', 'Personal', 'Library'];

export default function Dashboard({ initialCategories, initialLibraryItems, initialPanels }: { initialCategories: Category[]; initialLibraryItems: LibraryItem[]; initialPanels: string[] }) {
  const [categories, setCategories] = useState(initialCategories);
  const [customPanels, setCustomPanels] = useState(initialPanels);
  const [activePanel, setActivePanel] = useState('Work');
  const [isAddingPanel, setIsAddingPanel] = useState(false);
  const [newPanelName, setNewPanelName] = useState('');
  const [addPanelError, setAddPanelError] = useState('');
  const [movingCategory, setMovingCategory] = useState<Category | null>(null);
  const [moveToPanel, setMoveToPanel] = useState('');
  const [moveNewPanelName, setMoveNewPanelName] = useState('');
  const [moveCategoryError, setMoveCategoryError] = useState('');
  const [isMovingCategory, setIsMovingCategory] = useState(false);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [editingLink, setEditingLink] = useState<Link | null>(null);
  const [isAddingLink, setIsAddingLink] = useState<string | null>(null); // categoryId
  const [isMounted, setIsMounted] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [libraryItems, setLibraryItems] = useState(initialLibraryItems);
  const [isUploading, setIsUploading] = useState(false);
  const [librarySearch, setLibrarySearch] = useState('');
  const fileUploadRef = useRef<HTMLInputElement>(null);
  const [viewingPdf, setViewingPdf] = useState<LibraryItem | null>(null);
  const [pdfViewerFullscreen, setPdfViewerFullscreen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    setCategories(initialCategories);
  }, [initialCategories]);

  useEffect(() => {
    setLibraryItems(initialLibraryItems);
  }, [initialLibraryItems]);

  useEffect(() => {
    setCustomPanels(initialPanels);
  }, [initialPanels]);

  const panels = useMemo(
    () => Array.from(new Set(['Work', 'Personal', 'Library', ...customPanels, activePanel, ...categories.map(c => c.panel)])),
    [activePanel, categories, customPanels],
  );
  const categoryPanelOptions = useMemo(() => panels.filter((panel) => panel !== 'Library'), [panels]);
  const activeCategories = useMemo(() => categories.filter(c => c.panel === activePanel), [activePanel, categories]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && viewingPdf) {
        setViewingPdf(null);
        setPdfViewerFullscreen(false);
        return;
      }

      if (e.key === 'Escape' && isAddingPanel) {
        setIsAddingPanel(false);
        setNewPanelName('');
        setAddPanelError('');
        return;
      }

      if (e.key === 'Escape' && movingCategory) {
        setMovingCategory(null);
        setMoveToPanel('');
        setMoveNewPanelName('');
        setMoveCategoryError('');
        return;
      }

      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      const key = parseInt(e.key, 10);
      if (!isNaN(key) && key >= 1 && key <= 9) {
        const index = key - 1;
        if (index < panels.length) {
          setActivePanel(panels[index]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [panels, viewingPdf, isAddingPanel, movingCategory]);

  const handleAddCategory = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    await createCategory(formData);
    setIsAddingCategory(false);
  };

  const handleAddLink = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    await createLink(formData);
    setIsAddingLink(null);
  };

  const handleEditLink = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    await updateLink(formData);
    setEditingLink(null);
  };

  const handleImportBookmarks = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const text = await file.text();
      const result = await importBookmarks(text);
      alert(`Found ${result.totalFound} links in file.\nImported: ${result.imported}\nSkipped (duplicates): ${result.skipped}`);
    } catch (error) {
      console.error('Error importing bookmarks:', error);
      alert('Failed to import bookmarks. Please check the console for details.');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleUploadPdfs = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const files = formData.getAll('files') as File[];
    if (files.length === 0 || !files[0]?.name) return;

    setIsUploading(true);
    try {
      const result = await uploadPdfs(formData);
      alert(`Uploaded ${result?.uploaded ?? 0} PDF(s)`);
    } catch (error) {
      console.error('Error uploading PDFs:', error);
      alert('Failed to upload. Check the console for details.');
    } finally {
      setIsUploading(false);
      if (fileUploadRef.current) fileUploadRef.current.value = '';
    }
  };

  const handleAddPanel = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const panelName = newPanelName.trim();
    if (!panelName) {
      setAddPanelError('Panel name is required');
      return;
    }

    const panelExists = panels.some((panel) => panel.toLowerCase() === panelName.toLowerCase());
    if (panelExists) {
      setAddPanelError('Panel already exists');
      return;
    }

    const result = await createPanel(panelName);
    if (result?.error) {
      setAddPanelError(result.error);
      return;
    }

    setCustomPanels((prev) => (prev.includes(panelName) ? prev : [...prev, panelName]));
    setActivePanel(panelName);
    setIsAddingPanel(false);
    setNewPanelName('');
    setAddPanelError('');
  };

  const handleMoveCategory = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!movingCategory) return;

    const category = movingCategory;
    let targetPanel = moveToPanel.trim();

    if (!targetPanel) {
      setMoveCategoryError('Please choose a panel');
      return;
    }

    setIsMovingCategory(true);

    if (targetPanel === CREATE_NEW_PANEL_VALUE) {
      const newPanel = moveNewPanelName.trim();

      if (!newPanel) {
        setMoveCategoryError('New panel name is required');
        setIsMovingCategory(false);
        return;
      }

      const panelExists = panels.some((panel) => panel.toLowerCase() === newPanel.toLowerCase());
      if (panelExists) {
        setMoveCategoryError('Panel already exists');
        setIsMovingCategory(false);
        return;
      }

      const panelResult = await createPanel(newPanel);
      if (panelResult?.error) {
        setMoveCategoryError(panelResult.error);
        setIsMovingCategory(false);
        return;
      }

      setCustomPanels((prev) => (prev.includes(newPanel) ? prev : [...prev, newPanel]));
      targetPanel = newPanel;
    }

    if (targetPanel === category.panel) {
      setMovingCategory(null);
      setMoveToPanel('');
      setMoveNewPanelName('');
      setMoveCategoryError('');
      setIsMovingCategory(false);
      return;
    }

    const result = await moveCategoryToPanel(category.id, targetPanel);

    if (result?.error) {
      setMoveCategoryError(result.error);
      setIsMovingCategory(false);
      return;
    }

    setCategories((prev) =>
      prev.map((item) => (item.id === category.id ? { ...item, panel: targetPanel } : item)),
    );

    setMovingCategory(null);
    setMoveToPanel('');
    setMoveNewPanelName('');
    setMoveCategoryError('');
    setIsMovingCategory(false);

    const nextCategories = categories.map((item) =>
      item.id === category.id ? { ...item, panel: targetPanel } : item,
    );
    const sourceHasRemainingCategories = nextCategories.some(
      (item) => item.panel === category.panel,
    );

    if (!DEFAULT_PANELS.includes(category.panel) && !sourceHasRemainingCategories) {
      setCustomPanels((prev) => prev.filter((panel) => panel !== category.panel));
      await deletePanel(category.panel);
    }
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await fetch('/api/auth/signout', {
        method: 'POST',
        credentials: 'same-origin',
      });
    } catch {
      // Ignore network/API errors and continue redirecting to login.
    } finally {
      window.location.href = '/login';
    }
  };

  const normalizedLibrarySearch = librarySearch.trim().toLowerCase();

  const filteredLibraryItems = useMemo(
    () =>
      libraryItems.filter(item =>
        item.name.toLowerCase().includes(normalizedLibrarySearch) ||
        item.folder.toLowerCase().includes(normalizedLibrarySearch),
      ),
    [libraryItems, normalizedLibrarySearch],
  );

  const visibleLibraryItems = librarySearch ? filteredLibraryItems : libraryItems;

  const folderOrderMap = useMemo(() => {
    const map = new Map<string, number>();

    libraryItems.forEach(item => {
      if (!map.has(item.folder)) {
        map.set(item.folder, item.folderOrder);
      }
    });

    return map;
  }, [libraryItems]);

  const libraryFolders = useMemo(
    () =>
      Array.from(new Set(visibleLibraryItems.map(item => item.folder))).sort(
        (a, b) => (folderOrderMap.get(a) ?? 0) - (folderOrderMap.get(b) ?? 0),
      ),
    [folderOrderMap, visibleLibraryItems],
  );

  const libraryItemsByFolder = useMemo(() => {
    const grouped = new Map<string, LibraryItem[]>();

    visibleLibraryItems.forEach(item => {
      const items = grouped.get(item.folder);
      if (items) {
        items.push(item);
      } else {
        grouped.set(item.folder, [item]);
      }
    });

    grouped.forEach((items) => {
      items.sort((a, b) => a.order - b.order);
    });

    return grouped;
  }, [visibleLibraryItems]);

  const getLibraryItemsForFolder = (folder: string) => libraryItemsByFolder.get(folder) ?? [];

  const onLibraryDragEnd = async (result: DropResult) => {
    const { source, destination, type } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    if (type === 'library-folder') {
      const newFolders = Array.from(libraryFolders);
      const [removed] = newFolders.splice(source.index, 1);
      newFolders.splice(destination.index, 0, removed);

      const updates = newFolders.map((folder, index) => ({ folder, folderOrder: index }));

      setLibraryItems(prev => prev.map(item => {
        const update = updates.find(u => u.folder === item.folder);
        return update ? { ...item, folderOrder: update.folderOrder } : item;
      }));

      await updateLibraryFolderOrder(updates);
      return;
    }

    if (type === 'library-item') {
      const sourceFolder = source.droppableId.replace('lib-', '');
      const destFolder = destination.droppableId.replace('lib-', '');

      const sourceItems = libraryItems
        .filter(i => i.folder === sourceFolder)
        .sort((a, b) => a.order - b.order);

      if (sourceFolder === destFolder) {
        const newItems = Array.from(sourceItems);
        const [moved] = newItems.splice(source.index, 1);
        newItems.splice(destination.index, 0, moved);

        const updates = newItems.map((item, index) => ({
          id: item.id, order: index, folder: sourceFolder,
        }));

        setLibraryItems(prev => {
          const next = [...prev];
          updates.forEach(u => {
            const item = next.find(i => i.id === u.id);
            if (item) item.order = u.order;
          });
          return [...next];
        });

        await updateLibraryItemOrder(updates);
      } else {
        const destItems = libraryItems
          .filter(i => i.folder === destFolder)
          .sort((a, b) => a.order - b.order);

        const newSourceItems = Array.from(sourceItems);
        const newDestItems = Array.from(destItems);
        const [moved] = newSourceItems.splice(source.index, 1);
        newDestItems.splice(destination.index, 0, moved);

        const updates = [
          ...newSourceItems.map((item, index) => ({ id: item.id, order: index, folder: sourceFolder })),
          ...newDestItems.map((item, index) => ({ id: item.id, order: index, folder: destFolder })),
        ];

        setLibraryItems(prev => prev.map(item => {
          const update = updates.find(u => u.id === item.id);
          return update ? { ...item, order: update.order, folder: update.folder } : item;
        }));

        await updateLibraryItemOrder(updates);
      }
    }
  };

  const onDragEnd = async (result: DropResult) => {
    const { source, destination, type } = result;

    if (!destination) return;

    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    if (type === 'category') {
      if (
        source.droppableId === 'categories' &&
        destination.droppableId === 'panel-create-by-drop'
      ) {
        const draggedCategory = activeCategories[source.index];
        if (!draggedCategory) return;

        const previousPanel = draggedCategory.panel;
        const previousOrder = draggedCategory.order;

        const basePanelName = draggedCategory.name.trim() || 'New Panel';
        let targetPanel = basePanelName;
        let suffix = 2;

        while (panels.some((panel) => panel.toLowerCase() === targetPanel.toLowerCase())) {
          targetPanel = `${basePanelName} ${suffix}`;
          suffix += 1;
        }

        const createResult = await createPanel(targetPanel);
        if (createResult?.error) {
          return;
        }

        setCustomPanels((prev) => (prev.includes(targetPanel) ? prev : [...prev, targetPanel]));

        setCategories((prev) =>
          prev.map((item) =>
            item.id === draggedCategory.id ? { ...item, panel: targetPanel, order: 0 } : item,
          ),
        );

        setActivePanel(targetPanel);

        const moveResult = await moveCategoryToPanel(draggedCategory.id, targetPanel);
        if (moveResult?.error) {
          setCategories((prev) =>
            prev.map((item) =>
              item.id === draggedCategory.id
                ? { ...item, panel: previousPanel, order: previousOrder }
                : item,
            ),
          );
          setActivePanel(previousPanel);
          setCustomPanels((prev) => prev.filter((panel) => panel !== targetPanel));
          await deletePanel(targetPanel);
        } else {
          const nextCategories = categories.map((item) =>
            item.id === draggedCategory.id
              ? { ...item, panel: targetPanel, order: 0 }
              : item,
          );
          const sourceHasRemainingCategories = nextCategories.some(
            (item) => item.panel === previousPanel,
          );

          if (!DEFAULT_PANELS.includes(previousPanel) && !sourceHasRemainingCategories) {
            setCustomPanels((prev) => prev.filter((panel) => panel !== previousPanel));
            await deletePanel(previousPanel);
          }
        }

        return;
      }

      if (
        source.droppableId === 'categories' &&
        destination.droppableId.startsWith('panel-')
      ) {
        const targetPanel = destination.droppableId.replace('panel-', '');
        const draggedCategory = activeCategories[source.index];
        if (!draggedCategory) return;

        if (targetPanel === draggedCategory.panel || targetPanel === 'Library') {
          return;
        }

        const previousPanel = draggedCategory.panel;
        const previousOrder = draggedCategory.order;
        const targetNextOrder =
          categories
            .filter((item) => item.panel === targetPanel)
            .reduce((max, item) => Math.max(max, item.order), -1) + 1;

        setCategories((prev) =>
          prev.map((item) =>
            item.id === draggedCategory.id
              ? { ...item, panel: targetPanel, order: targetNextOrder }
              : item,
          ),
        );

        setActivePanel(targetPanel);

        const result = await moveCategoryToPanel(draggedCategory.id, targetPanel);
        if (result?.error) {
          setCategories((prev) =>
            prev.map((item) =>
              item.id === draggedCategory.id
                ? { ...item, panel: previousPanel, order: previousOrder }
                : item,
            ),
          );
          setActivePanel(previousPanel);
        } else {
          const nextCategories = categories.map((item) =>
            item.id === draggedCategory.id
              ? { ...item, panel: targetPanel, order: targetNextOrder }
              : item,
          );
          const sourceHasRemainingCategories = nextCategories.some(
            (item) => item.panel === previousPanel,
          );

          if (!DEFAULT_PANELS.includes(previousPanel) && !sourceHasRemainingCategories) {
            setCustomPanels((prev) => prev.filter((panel) => panel !== previousPanel));
            await deletePanel(previousPanel);
          }
        }

        return;
      }

      if (
        source.droppableId !== 'categories' ||
        destination.droppableId !== 'categories'
      ) {
        return;
      }

      const newCategories = Array.from(activeCategories);
      const [reorderedCategory] = newCategories.splice(source.index, 1);
      newCategories.splice(destination.index, 0, reorderedCategory);

      const updates = newCategories.map((cat, index) => ({
        id: cat.id,
        order: index,
      }));

      setCategories(prev => {
        const next = [...prev];
        updates.forEach(update => {
          const cat = next.find(c => c.id === update.id);
          if (cat) cat.order = update.order;
        });
        return next.sort((a, b) => a.order - b.order);
      });

      await updateCategoryOrder(updates);
      return;
    }

    if (type === 'link') {
      const sourceCategory = categories.find(c => c.id === source.droppableId);
      const destCategory = categories.find(c => c.id === destination.droppableId);

      if (!sourceCategory || !destCategory) return;

      if (source.droppableId === destination.droppableId) {
        const newLinks = Array.from(sourceCategory.links);
        const [reorderedLink] = newLinks.splice(source.index, 1);
        newLinks.splice(destination.index, 0, reorderedLink);

        const updates = newLinks.map((link, index) => ({
          id: link.id,
          order: index,
          categoryId: sourceCategory.id,
        }));

        setCategories(prev => prev.map(cat => {
          if (cat.id === sourceCategory.id) {
            return { ...cat, links: newLinks };
          }
          return cat;
        }));

        await updateLinkOrder(updates);
      } else {
        const sourceLinks = Array.from(sourceCategory.links);
        const destLinks = Array.from(destCategory.links);
        const [movedLink] = sourceLinks.splice(source.index, 1);
        
        movedLink.categoryId = destCategory.id;
        destLinks.splice(destination.index, 0, movedLink);

        const updates = [
          ...sourceLinks.map((link, index) => ({ id: link.id, order: index, categoryId: sourceCategory.id })),
          ...destLinks.map((link, index) => ({ id: link.id, order: index, categoryId: destCategory.id }))
        ];

        setCategories(prev => prev.map(cat => {
          if (cat.id === sourceCategory.id) return { ...cat, links: sourceLinks };
          if (cat.id === destCategory.id) return { ...cat, links: destLinks };
          return cat;
        }));

        await updateLinkOrder(updates);
      }
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    if (activePanel === 'Library') {
      await onLibraryDragEnd(result);
      return;
    }

    await onDragEnd(result);
  };

  if (!isMounted) return null;

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="h-screen overflow-hidden flex text-sm transition-colors duration-200">
      {/* Sidebar - Slack-style aubergine/dark */}
      <aside className="w-60 h-screen shrink-0 bg-slack-aubergine dark:bg-[#19171d] flex flex-col text-white/80">
        <div className="px-4 pt-4 pb-3 border-b border-white/10">
          <h1 className="text-lg font-black text-white tracking-tight">Kerv Command Hub</h1>
          <div className="mt-2">
            <ThemeToggle />
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-2 px-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-white/40 px-2 py-2">Panels</div>
          {panels.map((panel, index) => (
            <Droppable
              key={panel}
              droppableId={`panel-${panel}`}
              type="category"
              isDropDisabled={panel === 'Library' || activePanel === 'Library'}
            >
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`group/tab flex items-center rounded-md transition-colors ${
                    snapshot.isDraggingOver ? 'bg-white/10' : ''
                  }`}
                >
                  <button
                    onClick={() => setActivePanel(panel)}
                    className={`flex-1 flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] transition-colors ${
                      activePanel === panel
                        ? 'bg-slack-active dark:bg-white/10 text-white font-bold'
                        : 'text-white/70 hover:bg-white/10'
                    }`}
                  >
                    {index < 9 && <span className="text-[10px] opacity-40 font-mono">{index + 1}</span>}
                    <span className="truncate">{panel === 'Library' ? '\uD83D\uDCDA Library' : `# ${panel.toLowerCase()}`}</span>
                  </button>
                  {activePanel === panel && panel !== 'Library' && (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        const catCount = categories.filter(c => c.panel === panel).length;
                        const linkCount = categories.filter(c => c.panel === panel).reduce((sum, c) => sum + c.links.length, 0);
                        const msg = catCount > 0
                          ? `Delete panel "${panel}"? This will permanently delete ${catCount} categories and ${linkCount} links.`
                          : `Delete empty panel "${panel}"?`;
                        if (confirm(msg)) {
                          await deletePanel(panel);
                          setCustomPanels((prev) => prev.filter((storedPanel) => storedPanel !== panel));
                          const fallbackPanel = panels.find((existingPanel) => existingPanel !== panel) || 'Work';
                          setActivePanel(fallbackPanel);
                        }
                      }}
                      className="mr-1 text-white/30 hover:text-slack-red transition-colors opacity-0 group-hover/tab:opacity-100"
                      title={`Delete panel "${panel}"`}
                    >
                      <X size={12} />
                    </button>
                  )}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          ))}
          <Droppable
            droppableId="panel-create-by-drop"
            type="category"
            isDropDisabled={activePanel === 'Library'}
          >
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`mt-1 rounded-md transition-colors ${
                  snapshot.isDraggingOver ? 'bg-white/10' : ''
                }`}
              >
                <button
                  onClick={() => {
                    setIsAddingPanel(true);
                    setNewPanelName('');
                    setAddPanelError('');
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] text-white/40 hover:text-white/70 hover:bg-white/10 transition-colors"
                >
                  <Plus size={14} />
                  <span>Add panel</span>
                </button>
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </nav>

        {/* Sidebar footer actions */}
        {activePanel !== 'Library' && (
          <div className="p-3 border-t border-white/10 space-y-1">
            <input
              type="file"
              accept=".html"
              className="hidden"
              ref={fileInputRef}
              onChange={handleImportBookmarks}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] text-white/60 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40"
            >
              <Upload size={14} />
              <span>{isImporting ? 'Importing...' : 'Import Bookmarks'}</span>
            </button>
            <button
              onClick={() => setIsAddingCategory(true)}
              className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
              <Plus size={14} />
              <span>New Category</span>
            </button>
          </div>
        )}
        <div className="p-3 border-t border-white/10">
          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] text-white/60 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <LogOut size={14} />
            <span>{isSigningOut ? 'Signing Out...' : 'Sign Out'}</span>
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <main className="flex-1 bg-background overflow-y-auto">
        {/* Top bar */}
        <div className="sticky top-0 z-10 bg-surface dark:bg-surface border-b border-line px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-ink">
              {activePanel === 'Library' ? '\uD83D\uDCDA Library' : `# ${activePanel.toLowerCase()}`}
            </span>
          </div>
        </div>

        <div className="p-6">
          {isAddingCategory && activePanel !== 'Library' && (
            <div className="mb-6 p-4 bg-surface dark:bg-surface rounded-lg border border-line shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-sm font-bold text-ink">Add Category</h2>
                <button onClick={() => setIsAddingCategory(false)} className="text-ink-muted hover:text-ink">
                  <X size={16} />
                </button>
              </div>
              <form onSubmit={handleAddCategory} className="flex gap-3">
                <input type="hidden" name="panel" value={activePanel} />
                <input
                  type="text"
                  name="name"
                  placeholder="Category name"
                  required
                  autoFocus
                  className="flex-1 bg-background border border-line rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slack-blue/50 focus:border-slack-blue text-sm text-ink placeholder:text-ink-muted"
                />
                <button type="submit" className="bg-slack-green hover:bg-slack-green-hover text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors">
                  Save
                </button>
              </form>
            </div>
          )}

          {activePanel === 'Library' ? (
            <div>
              {/* Upload controls */}
              <div className="mb-6 p-4 bg-surface dark:bg-surface rounded-lg border border-line shadow-sm">
                <form onSubmit={handleUploadPdfs} className="flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-ink-secondary mb-1.5">Upload PDFs</label>
                    <input
                      type="file"
                      name="files"
                      accept=".pdf"
                      multiple
                      ref={fileUploadRef}
                      className="w-full bg-background border border-line rounded-lg px-3 py-2 text-sm text-ink file:mr-3 file:rounded file:border-0 file:bg-slack-blue/10 file:px-3 file:py-1 file:text-sm file:text-slack-blue"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-ink-secondary mb-1.5">Folder</label>
                    <input
                      type="text"
                      name="folder"
                      placeholder="Uploads"
                      className="bg-background border border-line rounded-lg px-3 py-2 text-sm text-ink w-40"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isUploading}
                    className="flex items-center gap-2 bg-slack-green hover:bg-slack-green-hover text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    <Upload size={14} className={isUploading ? 'animate-pulse' : ''} />
                    <span>{isUploading ? 'Uploading...' : 'Upload'}</span>
                  </button>
                </form>
              </div>

              {/* Search */}
              {libraryItems.length > 0 && (
                <div className="mb-4 relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                  <input
                    type="text"
                    placeholder="Search PDFs..."
                    value={librarySearch}
                    onChange={(e) => setLibrarySearch(e.target.value)}
                    className="w-full bg-surface dark:bg-surface border border-line rounded-lg px-3 py-2 pl-10 focus:outline-none focus:ring-2 focus:ring-slack-blue/50 focus:border-slack-blue text-sm text-ink placeholder:text-ink-muted"
                  />
                </div>
              )}

              {/* Stats */}
              {libraryItems.length > 0 && (
                <div className="mb-4 text-xs text-ink-muted font-bold">
                  {filteredLibraryItems.length} PDFs {librarySearch && `matching "${librarySearch}"`} Â· {libraryFolders.length} folders
                </div>
              )}

              {/* PDF Grid grouped by folder */}
              {libraryItems.length === 0 ? (
                <div className="text-ink-muted text-sm py-12 text-center border-2 border-dashed border-line rounded-lg">
                  No PDFs in library yet. Set a directory path and click &quot;Scan for PDFs&quot; to get started.
                </div>
              ) : filteredLibraryItems.length === 0 ? (
                <div className="text-ink-muted text-sm py-12 text-center border-2 border-dashed border-line rounded-lg">
                  No PDFs matching &quot;{librarySearch}&quot;
                </div>
              ) : (
                <Droppable droppableId="library-folders" type="library-folder">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-6">
                      {libraryFolders.map((folder, folderIndex) => {
                        const folderItems = getLibraryItemsForFolder(folder);

                        return (
                          <Draggable key={folder} draggableId={`folder-${folder}`} index={folderIndex} isDragDisabled={!!librarySearch}>
                            {(provided) => (
                              <div ref={provided.innerRef} {...provided.draggableProps}>
                                <div className="flex items-center gap-2 mb-2 group/folder-header">
                                  <div
                                    {...provided.dragHandleProps}
                                    className={`text-ink-muted hover:text-ink-secondary cursor-grab active:cursor-grabbing transition-opacity ${librarySearch ? 'hidden' : 'opacity-0 group-hover/folder-header:opacity-100'}`}
                                  >
                                    <GripVertical size={14} />
                                  </div>
                                  <FolderOpen size={14} className="text-slack-yellow" />
                                  <h3 className="text-xs font-bold text-ink-secondary uppercase tracking-wide">{folder}</h3>
                                  <span className="text-[11px] text-ink-muted">
                                    ({folderItems.length})
                                  </span>
                                </div>

                                <Droppable droppableId={`lib-${folder}`} type="library-item">
                                  {(provided) => (
                                    <div ref={provided.innerRef} {...provided.droppableProps} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 min-h-10">
                                      {folderItems.map((item, itemIndex) => (
                                        <Draggable key={item.id} draggableId={item.id} index={itemIndex} isDragDisabled={!!librarySearch}>
                                          {(provided) => (
                                            <div
                                              ref={provided.innerRef}
                                              {...provided.draggableProps}
                                              className="group flex items-center gap-2.5 p-2.5 rounded-lg border border-line bg-surface dark:bg-surface hover:bg-surface-hover hover:shadow-sm transition-all"
                                            >
                                              <div
                                                {...provided.dragHandleProps}
                                                className={`text-ink-muted hover:text-ink-secondary cursor-grab active:cursor-grabbing transition-opacity shrink-0 ${librarySearch ? 'hidden' : 'opacity-0 group-hover:opacity-100'}`}
                                              >
                                                <GripVertical size={14} />
                                              </div>
                                              <FileText size={18} className="text-slack-red shrink-0" />
                                              <div className="flex-1 min-w-0">
                                                <button
                                                  onClick={() => setViewingPdf(item)}
                                                  className="block truncate text-sm text-ink hover:text-slack-blue transition-colors text-left w-full font-medium"
                                                  title={`View ${item.name}`}
                                                >
                                                  {item.name}
                                                </button>
                                              </div>
                                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <a
                                                  href={item.viewUrl}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="p-1 rounded hover:bg-background text-ink-muted hover:text-ink transition-colors"
                                                  title="Open in new tab"
                                                >
                                                  <ExternalLink size={13} />
                                                </a>
                                                <button
                                                  onClick={async () => { await navigator.clipboard.writeText(item.viewUrl); }}
                                                  className="p-1 rounded hover:bg-background text-ink-muted hover:text-ink transition-colors"
                                                  title="Copy URL"
                                                >
                                                  <Copy size={13} />
                                                </button>
                                                <button
                                                  onClick={async () => {
                                                    if (confirm(`Remove "${item.name}" from library?`)) {
                                                      await deleteLibraryItem(item.id);
                                                    }
                                                  }}
                                                  className="p-1 rounded hover:bg-background text-ink-muted hover:text-slack-red transition-colors"
                                                  title="Remove from library"
                                                >
                                                  <Trash2 size={13} />
                                                </button>
                                              </div>
                                            </div>
                                          )}
                                        </Draggable>
                                      ))}
                                      {provided.placeholder}
                                    </div>
                                  )}
                                </Droppable>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              )}
            </div>
          ) : (
            <Droppable droppableId="categories" type="category" direction="horizontal">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-8"
                >
                  {activeCategories.length === 0 && (
                    <div className="col-span-full text-ink-muted text-sm py-12 text-center border-2 border-dashed border-line rounded-lg">
                      No categories in this panel yet. Click &quot;New Category&quot; to add one.
                    </div>
                  )}
                  {activeCategories.map((category, index) => (
                    <Draggable key={category.id} draggableId={category.id} index={index}>
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className="flex flex-col bg-surface dark:bg-surface rounded-lg border border-line p-4 shadow-sm"
                        >
                          <div className="flex justify-between items-center mb-3 group/header">
                            <div className="flex items-center gap-2">
                              <div
                                {...provided.dragHandleProps}
                                className="text-ink-muted hover:text-ink-secondary cursor-grab active:cursor-grabbing opacity-0 group-hover/header:opacity-100 transition-opacity"
                              >
                                <GripVertical size={14} />
                              </div>
                              <h2 className="text-xs font-bold text-ink-secondary uppercase tracking-wide">{category.name}</h2>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setIsAddingLink(category.id)}
                                className="text-ink-muted hover:text-slack-blue transition-colors"
                                title="Add Link"
                              >
                                <Plus size={14} />
                              </button>
                              <button
                                onClick={() => {
                                  setMovingCategory(category);
                                  setMoveToPanel(category.panel);
                                  setMoveNewPanelName(category.name);
                                  setMoveCategoryError('');
                                }}
                                className="text-ink-muted hover:text-slack-blue transition-colors"
                                title="Move Folder to Panel"
                              >
                                <FolderOpen size={14} />
                              </button>
                              <button
                                onClick={async () => {
                                  if (confirm('Are you sure you want to delete this category and all its links?')) {
                                    await deleteCategory(category.id);
                                  }
                                }}
                                className="text-ink-muted hover:text-slack-red transition-colors"
                                title="Delete Category"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>

                          <Droppable droppableId={category.id} type="link">
                            {(provided) => (
                              <div
                                {...provided.droppableProps}
                                ref={provided.innerRef}
                                className="flex-1 flex flex-col gap-0.5 min-h-12"
                              >
                                {category.links.map((link, index) => (
                                  <Draggable key={link.id} draggableId={link.id} index={index}>
                                    {(provided) => (
                                      <div
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        className="group flex items-center justify-between py-1.5 px-2 -mx-1 rounded-md hover:bg-surface-hover transition-colors"
                                      >
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                          <div
                                            {...provided.dragHandleProps}
                                            className="text-ink-muted hover:text-ink-secondary cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
                                          >
                                            <GripVertical size={14} />
                                          </div>
                                          <a
                                            href={link.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-start gap-2 flex-1 min-w-0"
                                          >
                                            <span className="text-slack-blue font-bold mt-0.5 shrink-0">{'\u203A'}</span>
                                            <div className="flex flex-col min-w-0">
                                              <span className="truncate text-ink group-hover:text-slack-blue transition-colors font-medium">{link.name}</span>
                                              {link.description && (
                                                <span className="truncate text-ink-muted text-xs mt-0.5">{link.description}</span>
                                              )}
                                            </div>
                                          </a>
                                        </div>
                                        <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity ml-3">
                                          <button
                                            onClick={() => setEditingLink(link)}
                                            className="p-1 rounded hover:bg-background text-ink-muted hover:text-ink transition-colors"
                                          >
                                            <Edit2 size={13} />
                                          </button>
                                          <button
                                            onClick={async () => {
                                              if (confirm('Delete this link?')) {
                                                await deleteLink(link.id);
                                              }
                                            }}
                                            className="p-1 rounded hover:bg-background text-ink-muted hover:text-slack-red transition-colors"
                                          >
                                            <Trash2 size={13} />
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </Draggable>
                                ))}
                                {provided.placeholder}
                                {category.links.length === 0 && (
                                  <div className="text-ink-muted text-xs italic py-2 px-2">No links yet</div>
                                )}
                              </div>
                            )}
                          </Droppable>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          )}
        </div>
      </main>

      {/* Add Link Modal */}
      {isAddingLink && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-surface rounded-xl border border-line p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-base font-bold text-ink">Add a link</h2>
              <button onClick={() => setIsAddingLink(null)} className="text-ink-muted hover:text-ink p-1 rounded hover:bg-surface-hover">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddLink} className="flex flex-col gap-4">
              <input type="hidden" name="categoryId" value={isAddingLink} />
              <div>
                <label className="block text-sm font-bold text-ink-secondary mb-1">Name</label>
                <input
                  type="text"
                  name="name"
                  required
                  autoFocus
                  className="w-full bg-background border border-line rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slack-blue/50 focus:border-slack-blue text-sm text-ink"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-ink-secondary mb-1">URL</label>
                <input
                  type="url"
                  name="url"
                  required
                  placeholder="https://"
                  className="w-full bg-background border border-line rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slack-blue/50 focus:border-slack-blue text-sm text-ink placeholder:text-ink-muted"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-ink-secondary mb-1">Description <span className="font-normal text-ink-muted">(optional)</span></label>
                <input
                  type="text"
                  name="description"
                  placeholder="Brief description..."
                  className="w-full bg-background border border-line rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slack-blue/50 focus:border-slack-blue text-sm text-ink placeholder:text-ink-muted"
                />
              </div>
              <button type="submit" className="w-full bg-slack-green hover:bg-slack-green-hover text-white px-4 py-2.5 rounded-lg text-sm font-bold transition-colors mt-2">
                Add Link
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Panel Modal */}
      {isAddingPanel && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-surface rounded-xl border border-line p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-base font-bold text-ink">Add a panel</h2>
              <button
                onClick={() => {
                  setIsAddingPanel(false);
                  setNewPanelName('');
                  setAddPanelError('');
                }}
                className="text-ink-muted hover:text-ink p-1 rounded hover:bg-surface-hover"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddPanel} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-bold text-ink-secondary mb-1">Panel name</label>
                <input
                  type="text"
                  value={newPanelName}
                  onChange={(e) => {
                    setNewPanelName(e.target.value);
                    if (addPanelError) setAddPanelError('');
                  }}
                  required
                  autoFocus
                  className="w-full bg-background border border-line rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slack-blue/50 focus:border-slack-blue text-sm text-ink placeholder:text-ink-muted"
                  placeholder="e.g. Finance"
                />
                {addPanelError && (
                  <p className="mt-2 text-xs text-slack-red">{addPanelError}</p>
                )}
              </div>
              <button
                type="submit"
                className="w-full bg-slack-green hover:bg-slack-green-hover text-white px-4 py-2.5 rounded-lg text-sm font-bold transition-colors mt-2"
              >
                Add Panel
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Move Folder Modal */}
      {movingCategory && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-surface rounded-xl border border-line p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-base font-bold text-ink">Move folder to panel</h2>
              <button
                onClick={() => {
                  setMovingCategory(null);
                  setMoveToPanel('');
                  setMoveNewPanelName('');
                  setMoveCategoryError('');
                }}
                className="text-ink-muted hover:text-ink p-1 rounded hover:bg-surface-hover"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleMoveCategory} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-bold text-ink-secondary mb-1">Folder</label>
                <input
                  type="text"
                  value={movingCategory.name}
                  readOnly
                  className="w-full bg-background border border-line rounded-lg px-3 py-2 text-sm text-ink-muted"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-ink-secondary mb-1">Panel</label>
                <select
                  value={moveToPanel}
                  onChange={(e) => {
                    setMoveToPanel(e.target.value);
                    if (moveCategoryError) setMoveCategoryError('');
                  }}
                  className="w-full bg-background border border-line rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slack-blue/50 focus:border-slack-blue text-sm text-ink"
                >
                  {categoryPanelOptions.map((panel) => (
                    <option key={panel} value={panel}>
                      {panel}
                    </option>
                  ))}
                  <option value={CREATE_NEW_PANEL_VALUE}>+ Create new panel</option>
                </select>
              </div>

              {moveToPanel === CREATE_NEW_PANEL_VALUE && (
                <div>
                  <label className="block text-sm font-bold text-ink-secondary mb-1">New panel name</label>
                  <input
                    type="text"
                    value={moveNewPanelName}
                    onChange={(e) => {
                      setMoveNewPanelName(e.target.value);
                      if (moveCategoryError) setMoveCategoryError('');
                    }}
                    className="w-full bg-background border border-line rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slack-blue/50 focus:border-slack-blue text-sm text-ink placeholder:text-ink-muted"
                    placeholder="e.g. Finance"
                  />
                </div>
              )}

              {moveCategoryError && <p className="-mt-1 text-xs text-slack-red">{moveCategoryError}</p>}

              <button
                type="submit"
                disabled={isMovingCategory}
                className="w-full bg-slack-green hover:bg-slack-green-hover text-white px-4 py-2.5 rounded-lg text-sm font-bold transition-colors mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isMovingCategory ? 'Moving...' : 'Move Folder'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Link Modal */}
      {editingLink && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-surface rounded-xl border border-line p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-base font-bold text-ink">Edit link</h2>
              <button onClick={() => setEditingLink(null)} className="text-ink-muted hover:text-ink p-1 rounded hover:bg-surface-hover">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleEditLink} className="flex flex-col gap-4">
              <input type="hidden" name="id" value={editingLink.id} />
              <div>
                <label className="block text-sm font-bold text-ink-secondary mb-1">Name</label>
                <input
                  type="text"
                  name="name"
                  defaultValue={editingLink.name}
                  required
                  autoFocus
                  className="w-full bg-background border border-line rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slack-blue/50 focus:border-slack-blue text-sm text-ink"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-ink-secondary mb-1">URL</label>
                <input
                  type="url"
                  name="url"
                  defaultValue={editingLink.url}
                  required
                  className="w-full bg-background border border-line rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slack-blue/50 focus:border-slack-blue text-sm text-ink"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-ink-secondary mb-1">Description <span className="font-normal text-ink-muted">(optional)</span></label>
                <input
                  type="text"
                  name="description"
                  defaultValue={editingLink.description || ''}
                  placeholder="Brief description..."
                  className="w-full bg-background border border-line rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slack-blue/50 focus:border-slack-blue text-sm text-ink placeholder:text-ink-muted"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-ink-secondary mb-1">Category</label>
                <select
                  name="categoryId"
                  defaultValue={editingLink.categoryId}
                  className="w-full bg-background border border-line rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slack-blue/50 focus:border-slack-blue text-sm text-ink"
                >
                  {panels.map(panel => {
                    const panelCategories = initialCategories.filter(c => c.panel === panel);
                    if (panelCategories.length === 0) return null;
                    return (
                      <optgroup key={panel} label={panel}>
                        {panelCategories.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
              </div>
              <button type="submit" className="w-full bg-slack-green hover:bg-slack-green-hover text-white px-4 py-2.5 rounded-lg text-sm font-bold transition-colors mt-2">
                Save Changes
              </button>
            </form>
          </div>
        </div>
      )}

      {/* PDF Viewer Modal */}
      {viewingPdf && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex flex-col z-50">
          <div className="flex items-center justify-between px-4 py-3 bg-surface dark:bg-surface border-b border-line shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <FileText size={18} className="text-slack-red shrink-0" />
              <span className="text-sm font-bold text-ink truncate">{viewingPdf.name}</span>
              <span className="text-xs text-ink-muted truncate hidden md:block">{viewingPdf.folder}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setPdfViewerFullscreen(f => !f)}
                className="p-1.5 rounded-md hover:bg-surface-hover text-ink-muted hover:text-ink transition-colors"
                title={pdfViewerFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              >
                {pdfViewerFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
              <a
                href={viewingPdf.viewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-md hover:bg-surface-hover text-ink-muted hover:text-ink transition-colors"
                title="Open in new tab"
              >
                <ExternalLink size={16} />
              </a>
              <button
                onClick={() => { setViewingPdf(null); setPdfViewerFullscreen(false); }}
                className="p-1.5 rounded-md hover:bg-surface-hover text-ink-muted hover:text-ink transition-colors"
                title="Close viewer"
              >
                <X size={16} />
              </button>
            </div>
          </div>
          <div className={`flex-1 bg-background ${pdfViewerFullscreen ? '' : 'p-4 md:p-8'}`}>
            <iframe
              src={viewingPdf.viewUrl}
              className={`w-full h-full border-0 ${pdfViewerFullscreen ? '' : 'rounded-lg border border-line shadow-lg'}`}
              title={viewingPdf.name}
            />
          </div>
        </div>
      )}
      </div>
    </DragDropContext>
  );
}
