
import { ImportedLayer } from '../types';

const DB_NAME = 'topogan-db';
const STORE_NAME = 'layers';
const DB_VERSION = 1;

/**
 * Ouvre la base de données IndexedDB.
 */
export const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        // Vérification de la compatibilité navigateur
        if (!window.indexedDB) {
            reject(new Error("IndexedDB n'est pas supporté par ce navigateur."));
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error("IndexedDB error:", request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                // Création du store avec 'id' comme clé primaire
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });
};

/**
 * Charge toutes les couches sauvegardées depuis IndexedDB.
 */
export const loadAllLayers = async (): Promise<ImportedLayer[]> => {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result || []);
            };
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.error("Erreur lors de l'ouverture de la DB pour lecture:", e);
        return [];
    }
};

/**
 * Sauvegarde la liste complète des couches dans IndexedDB.
 * Cette opération écrase l'état précédent pour garantir la synchronisation (suppressions/modifications).
 */
export const saveAllLayers = async (layers: ImportedLayer[]): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        // On efface d'abord tout pour s'assurer que les couches supprimées dans l'UI le sont aussi en base
        const clearRequest = store.clear();
        
        clearRequest.onsuccess = () => {
            if (layers.length === 0) {
                resolve();
                return;
            }
            
            let processed = 0;
            let errorOccurred = false;

            layers.forEach(layer => {
                const req = store.add(layer);
                req.onsuccess = () => {
                    processed++;
                    if (processed === layers.length) resolve();
                };
                req.onerror = () => {
                    if (!errorOccurred) {
                        errorOccurred = true;
                        // En cas d'erreur (ex: quota disque réel atteint), on annule la transaction
                        transaction.abort();
                        reject(req.error);
                    }
                };
            });
        };

        clearRequest.onerror = () => reject(clearRequest.error);
    });
};
