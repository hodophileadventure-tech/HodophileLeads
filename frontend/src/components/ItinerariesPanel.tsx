import React, { useMemo, useState } from 'react';
import { Button, Modal } from './common';

const privateImageFiles = [
  '10Days Fairy Meadows, Hunza & Skardu.jpg',
  '10Days Fairy Meadows, Skardu & Naltar.jpg',
  '10Days Kartarpur, Nankana Sahib, Skardu & Naran.jpg',
  // '10Days-Astore-Minimarg-&-Naran.jpg', (removed)
  '3Days Naran itinerary.jpg',
  '3Days Swat & Kalam.jpg',
  '3Days-Kashmir.jpg',
  '3Days-Murree-&-NathiyaGali-(from-LHR).jpg',
  '4Day Naran & Shogran.jpg',
  '4Days-Kashmir.jpg',
  '4Days-Swat-&-Kalam.jpg',
  '5Days Naran & Shogran (Private).jpg',
  '5Days Naran & Shogran.jpg',
  '5Days Swat & Kalam.jpg',
  '5Days-Kashmir-&-Taobat.jpg',
  '6Days Astore & Minimarg.jpg',
  '6Days Kashmir & Shogran (Customized).jpg',
  '6Days Naran Shogran & Murree.jpg',
  '6Days Skardu itinerary.jpg',
  '6Days-Swat-&-Kashmir.jpg',
  '6Days-Swat-&-Shogran.jpg',
  '7Days-Swat-&-Kashmir.jpg',
  '8Days Fairy Meadows & Skardu.jpg',
  'Naran & Shogran.jpg',
];

const groupImageFiles: string[] = [
  '10 Days 9 Nights Astore Domel Minimarg and Naran Valley.jpeg',
  '10 Days 9 Nights Skardu Deosai Naran Valley.jpeg',
  '12 days 11 night Hunza Skardu Basho and Naran Valley.jpeg',
  '12 Days 11 Nights Skardu Fairy Meadows.jpeg',
];

const folderItems = [
  { key: 'private', label: 'Private', files: privateImageFiles },
  { key: 'group', label: 'Group', files: groupImageFiles }
] as const;

type FolderKey = (typeof folderItems)[number]['key'];

const buildImageUrl = (folder: FolderKey, filename: string) => {
  return `/itineraries/${folder}/${encodeURI(filename)}`;
};

export const ItinerariesPanel: React.FC = () => {
  const [selectedFolder, setSelectedFolder] = useState<FolderKey>('private');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeImage, setActiveImage] = useState<{ name: string; url: string } | null>(null);

  const currentFolder = useMemo(
    () => folderItems.find((item) => item.key === selectedFolder) || folderItems[0],
    [selectedFolder]
  );

  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return currentFolder.files;
    const q = searchQuery.toLowerCase();
    return currentFolder.files.filter((f) => f.toLowerCase().includes(q));
  }, [currentFolder, searchQuery]);

  return (
    <div className="space-y-6">
      <section className="card">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Itineraries</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Browse itinerary folders and open itinerary images fullscreen. Download any image directly from the lightbox.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {folderItems.map((folder) => (
              <Button
                key={folder.key}
                variant={selectedFolder === folder.key ? 'primary' : 'secondary'}
                onClick={() => setSelectedFolder(folder.key)}
              >
                {folder.label}
              </Button>
            ))}
          </div>
        </div>
      </section>

      <section className="card">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-semibold">{currentFolder.label} Itineraries</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {currentFolder.files.length === 0
                ? 'No images available in this folder yet.'
                : `Showing ${filteredFiles.length} of ${currentFolder.files.length} ${currentFolder.files.length === 1 ? 'image' : 'images'}.`}
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="search"
              aria-label="Search itineraries"
              placeholder="Search itineraries by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input input-sm w-full sm:w-64"
            />
          </div>
        </div>

        {currentFolder.files.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-slate-500 dark:text-slate-400">
            Group itineraries are empty. Private itineraries will appear here once added.
          </div>
        ) : (
          <div>
            {filteredFiles.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-slate-500 dark:text-slate-400">
                No itineraries match your search.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredFiles.map((filename) => {
                  const url = buildImageUrl(currentFolder.key, filename);
                  return (
                    <button
                      key={filename}
                      type="button"
                      onClick={() => setActiveImage({ name: filename, url })}
                      className="group block overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <img
                        src={url}
                        alt={filename}
                        className="h-40 w-full object-cover transition-transform duration-200 group-hover:scale-105"
                      />
                      <div className="p-3 text-left">
                        <p className="text-sm font-medium truncate text-slate-900 dark:text-slate-100">{filename}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>

      {activeImage && (
        <Modal
          isOpen={Boolean(activeImage)}
          onClose={() => setActiveImage(null)}
          title={activeImage.name}
          footer={
            <>
              <Button variant="secondary" onClick={() => setActiveImage(null)}>
                Close
              </Button>
              <a href={activeImage.url} download={activeImage.name} className="btn btn-primary">
                Download
              </a>
            </>
          }
        >
          <div className="max-h-[80vh] overflow-auto">
            <img src={activeImage.url} alt={activeImage.name} className="mx-auto max-h-[75vh] w-full object-contain" />
          </div>
        </Modal>
      )}
    </div>
  );
};
