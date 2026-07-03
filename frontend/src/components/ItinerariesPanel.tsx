import React, { useMemo, useState } from 'react';
import { Button, Modal } from './common';

const privateImageFiles = [
  'WhatsApp Image 2026-07-01 at 1.43.03 PM (1).jpeg',
  'WhatsApp Image 2026-07-01 at 1.43.03 PM (10).jpeg',
  'WhatsApp Image 2026-07-01 at 1.43.03 PM (11).jpeg',
  'WhatsApp Image 2026-07-01 at 1.43.03 PM (12).jpeg',
  'WhatsApp Image 2026-07-01 at 1.43.03 PM (13).jpeg',
  'WhatsApp Image 2026-07-01 at 1.43.03 PM (14).jpeg',
  'WhatsApp Image 2026-07-01 at 1.43.03 PM (15).jpeg',
  'WhatsApp Image 2026-07-01 at 1.43.03 PM (2).jpeg',
  'WhatsApp Image 2026-07-01 at 1.43.03 PM (3).jpeg',
  'WhatsApp Image 2026-07-01 at 1.43.03 PM (4).jpeg',
  'WhatsApp Image 2026-07-01 at 1.43.03 PM (5).jpeg',
  'WhatsApp Image 2026-07-01 at 1.43.03 PM (6).jpeg',
  'WhatsApp Image 2026-07-01 at 1.43.03 PM (7).jpeg',
  'WhatsApp Image 2026-07-01 at 1.43.03 PM (8).jpeg',
  'WhatsApp Image 2026-07-01 at 1.43.03 PM (9).jpeg',
  'WhatsApp Image 2026-07-01 at 1.43.03 PM.jpeg',
  'WhatsApp Image 2026-07-01 at 1.43.04 PM (1).jpeg',
  'WhatsApp Image 2026-07-01 at 1.43.04 PM (2).jpeg',
  'WhatsApp Image 2026-07-01 at 1.43.04 PM (3).jpeg',
  'WhatsApp Image 2026-07-01 at 1.43.04 PM (4).jpeg',
  'WhatsApp Image 2026-07-01 at 1.43.04 PM (5).jpeg',
  'WhatsApp Image 2026-07-01 at 1.43.04 PM (6).jpeg',
  'WhatsApp Image 2026-07-01 at 1.43.04 PM (7).jpeg',
  'WhatsApp Image 2026-07-01 at 1.43.04 PM.jpeg',
  'WhatsApp Image 2026-07-01 at 1.43.44 PM.jpeg',
  'WhatsApp Image 2026-07-01 at 1.44.10 PM.jpeg',
  'WhatsApp Image 2026-07-01 at 1.45.05 PM.jpeg',
  'WhatsApp Image 2026-07-01 at 1.46.08 PM (1).jpeg',
  'WhatsApp Image 2026-07-01 at 1.46.08 PM (2).jpeg',
  'WhatsApp Image 2026-07-01 at 1.46.08 PM (3).jpeg',
  'WhatsApp Image 2026-07-01 at 1.46.08 PM (4).jpeg',
  'WhatsApp Image 2026-07-01 at 1.46.08 PM.jpeg',
];

const groupImageFiles: string[] = [];

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
  const [activeImage, setActiveImage] = useState<{ name: string; url: string } | null>(null);

  const currentFolder = useMemo(
    () => folderItems.find((item) => item.key === selectedFolder) || folderItems[0],
    [selectedFolder]
  );

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
        <div className="flex items-center justify-between mb-4 gap-4">
          <div>
            <h2 className="text-xl font-semibold">{currentFolder.label} Itineraries</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {currentFolder.files.length === 0
                ? 'No images available in this folder yet.'
                : `Showing ${currentFolder.files.length} ${currentFolder.files.length === 1 ? 'image' : 'images'}.`}
            </p>
          </div>
        </div>

        {currentFolder.files.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-slate-500 dark:text-slate-400">
            Group itineraries are empty. Private itineraries will appear here once added.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {currentFolder.files.map((filename) => {
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
