export type NasEntry = {
  equipmentId: string;
  itemName: string;
  operatorId: string;
  operatorName: string;
  folderName: string;
};

export type NasDownload = {
  plan_id: string;
  equipment_id: string;
  confirmed_at: string;
  confirmed_by: string;
  confirmed_by_name: string;
};

export function folderProgress(
  entries: Pick<NasEntry, "equipmentId">[],
  downloads: Pick<NasDownload, "equipment_id">[],
) {
  const folders = new Set(entries.map(entry => entry.equipmentId));
  const confirmed = new Set(downloads.map(download => download.equipment_id));
  return {
    total: folders.size,
    completed: [...folders].filter(id => confirmed.has(id)).length,
  };
}
