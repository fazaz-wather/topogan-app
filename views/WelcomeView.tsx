
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { View, Parcel, AppSettings, Riverain, Notification } from '../types';
import { calculatePolygonArea, calculateCentroid } from '../services/topographyService';
import { formatArea } from '../services/unitConversionService';
import { coordinateTransformationService } from '../services/coordinateTransformationService';
import { extractOwnerInfoFromImage } from '../services/ocrService';
import { MOROCCO_LOCATIONS } from '../data/moroccoLocations';

interface WelcomeViewProps {
    onNavigate: (view: View) => void;
    parcels: Parcel[];
    activeParcelId: number | null;
    setActiveParcelId: (id: number | null) => void;
    settings: AppSettings;
    parcelManager: any;
    setNotification?: (message: string, type: Notification['type']) => void;
    searchTerm?: string;
    [key: string]: any;
}

const NATURE_OPTIONS = ['BI', 'BC', 'MT'];
const CONSISTANCE_OPTIONS = ['TN', 'TC', 'T.Cult', 'RDC', 'R+1', 'R+2', 'R+3', 'R+4', 'R+5', 'S.S.R+..'];
const QUALITE_OPTIONS = ['Requérant', 'Représentant', 'Co-requérant'];

interface LocationSelectorModalProps {
    onConfirm: (fullAddress: string) => void;
    onClose: () => void;
    initialValue?: string;
}

const LocationSelectorModal: React.FC<LocationSelectorModalProps> = ({ onConfirm, onClose, initialValue }) => {
    const sortedPrefectures = useMemo(() => Object.keys(MOROCCO_LOCATIONS).sort(), []);
    const [prefecture, setPrefecture] = useState(sortedPrefectures[0]);
    const [commune, setCommune] = useState('');
    const [hay, setHay] = useState('');

    const availableCommunes = useMemo(() => {
        return (MOROCCO_LOCATIONS[prefecture] || []).sort();
    }, [prefecture]);

    // Set default commune when prefecture changes
    useEffect(() => {
        if (availableCommunes.length > 0 && !availableCommunes.includes(commune)) {
            setCommune(availableCommunes[0]);
        }
    }, [availableCommunes, commune]);

    useEffect(() => {
        if (initialValue) {
            const parts = initialValue.split(',').map(s => s.trim());
            
            // Find Prefecture
            const foundPref = sortedPrefectures.find(pref => 
                parts.some(p => p.toLowerCase().includes(pref.toLowerCase()) || pref.toLowerCase().includes(p.toLowerCase()))
            );
            
            if (foundPref) {
                setPrefecture(foundPref);
                
                // Find Commune within this Prefecture
                const prefCommunes = MOROCCO_LOCATIONS[foundPref] || [];
                const foundCommune = prefCommunes.find(c => 
                    parts.some(p => p.toLowerCase().includes(c.toLowerCase()))
                );
                
                if (foundCommune) {
                    setCommune(foundCommune);
                }
            } else {
                // Try to find any commune if prefecture not found
                for (const pref of sortedPrefectures) {
                    const comms = MOROCCO_LOCATIONS[pref];
                    const foundCommune = comms.find(c => parts.some(p => p.toLowerCase().includes(c.toLowerCase())));
                    if (foundCommune) {
                        setPrefecture(pref);
                        setCommune(foundCommune);
                        break;
                    }
                }
            }

            // Extract Hay/Douar
            const remainingParts = parts.filter(p => {
                const lowerP = p.toLowerCase();
                const isPref = sortedPrefectures.some(pref => lowerP.includes(pref.toLowerCase()) || pref.toLowerCase().includes(lowerP));
                // Check against all communes might be slow, but let's check against current selected ones or just skip common keywords
                const isTag = lowerP.includes('préfecture') || lowerP.includes('province') || lowerP.includes('c.t') || lowerP.includes('commune') || lowerP.includes('pre') || lowerP.includes('pachalik');
                
                // Check if it matches the found commune
                // We can't easily check against ALL communes efficiently here without a reverse map, 
                // but we can assume if we found a commune, we exclude it.
                // For now, let's just exclude the keywords and rely on user to correct if needed.
                return !isPref && !isTag; 
            });
            
            // Refine remaining parts to exclude the found commune string if possible
            // (This logic is a bit simplified compared to previous one but should work for most cases)
            
            if (remainingParts.length > 0) {
                const rawHay = remainingParts.join(', ');
                // Remove the commune name if it appears in the remaining parts (case insensitive)
                // This is tricky because parts are split by comma.
                // Let's just set Hay to the joined remaining parts for now.
                setHay(rawHay.replace(/^(Hay|Douar)\s+/i, '$1 ').trim());
            }
        }
    }, [initialValue, sortedPrefectures]);

    const handleConfirm = () => {
        const parts = [];
        parts.push(prefecture);
        const communeStr = commune.toLowerCase().startsWith('c.t') ? commune : `C.T ${commune}`;
        parts.push(communeStr);
        if (hay.trim()) parts.push(hay.trim());
        onConfirm(parts.join(', '));
    };

    return (
        <div className="fixed inset-0 bg-[#0F172A]/80 flex items-center justify-center z-[1300] p-4 backdrop-blur-md" onClick={onClose}>
            <div className="bg-white dark:bg-[#0F172A] rounded-2xl shadow-2xl w-full max-w-md p-6 transform transition-all scale-100 border border-[#F1F5F9] dark:border-[#1E293B]" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6 border-b border-[#F1F5F9] dark:border-[#1E293B] pb-4">
                    <h3 className="text-lg font-bold text-[#0F172A] dark:text-white">Assistant Situation</h3>
                    <button onClick={onClose} className="text-[#94A3B8] hover:text-[#475569] dark:hover:text-[#CBD5E1] transition-colors p-2 hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B] rounded-xl">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18 L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="space-y-5">
                    <div>
                        <label className="bsport-label">1. Préfecture / Province</label>
                        <select value={prefecture} onChange={(e) => setPrefecture(e.target.value)} className="bsport-select">
                            {sortedPrefectures.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="bsport-label">2. Commune / C.T</label>
                        <select value={commune} onChange={(e) => setCommune(e.target.value)} className="bsport-select">
                            {availableCommunes.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="bsport-label">3. Lieu-dit (Hay / Douar)</label>
                        <input type="text" value={hay} onChange={(e) => setHay(e.target.value)} placeholder="Ex: Hay Al Amal, Douar X..." className="bsport-input" autoFocus />
                    </div>
                </div>
                <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-[#F1F5F9] dark:border-[#1E293B]">
                    <button onClick={onClose} className="bsport-btn-secondary">Annuler</button>
                    <button onClick={handleConfirm} className="bsport-btn-primary">Appliquer</button>
                </div>
            </div>
        </div>
    );
};

const ToolCard: React.FC<{ title: string; description: string; icon: React.ReactNode; onClick: () => void; colorClass: string }> = ({ title, description, icon, onClick, colorClass }) => (
    <div onClick={onClick} className="group relative bsport-card hover:border-[#4F46E5]/30 hover:shadow-[0_8px_30px_-5px_rgba(79,70,229,0.15)] cursor-pointer flex flex-col h-full min-h-[140px]">
        <div className="flex items-center mb-3">
            <div className={`p-2.5 rounded-xl ${colorClass} bg-opacity-10 dark:bg-opacity-20 mr-3`}>{icon}</div>
            <h3 className="text-[15px] font-bold text-[#0F172A] dark:text-white group-hover:text-[#4F46E5] dark:group-hover:text-[#818CF8] transition-colors">{title}</h3>
        </div>
        <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8] leading-relaxed flex-grow">{description}</p>
        <div className="mt-4 flex items-center text-[13px] font-bold text-[#4F46E5] dark:text-[#818CF8] opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-5 right-5">Ouvrir <svg className="ml-1 w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg></div>
    </div>
);

const SectionHeader: React.FC<{ title: string; icon?: React.ReactNode; rightElement?: React.ReactNode }> = ({ title, icon, rightElement }) => (
    <div className="flex items-center space-x-2 mb-4 mt-2">
        <div className="h-px bg-[#E2E8F0] dark:bg-[#334155] flex-grow"></div>
        <div className="flex items-center gap-2 px-3">
            {icon && <span className="text-[#4F46E5] dark:text-[#818CF8]">{icon}</span>}
            <span className="text-xs font-bold uppercase tracking-widest text-[#64748B] dark:text-[#94A3B8]">{title}</span>
            {rightElement}
        </div>
        <div className="h-px bg-[#E2E8F0] dark:bg-[#334155] flex-grow"></div>
    </div>
);

const InputField = React.forwardRef<HTMLInputElement, { label: string; value: string; onChange: (val: string) => void; onClick?: () => void; placeholder?: string; type?: string; disabled?: boolean; readOnly?: boolean; rightElement?: React.ReactNode; className?: string }>(({ label, value, onChange, onClick, placeholder, type = "text", disabled = false, readOnly = false, rightElement, className }, ref) => (
    <div className={className}>
        <label className="bsport-label truncate">{label}</label>
        <div className="relative">
            <input 
                ref={ref} 
                type={type} 
                className={`bsport-input ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${readOnly ? 'cursor-pointer hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]' : ''} ${rightElement ? 'pr-20' : ''}`} 
                placeholder={placeholder} 
                value={value || ''} 
                onChange={(e) => onChange(e.target.value)} 
                onClick={onClick} 
                disabled={disabled} 
                readOnly={readOnly} 
            />
            {rightElement && (
                <div className="absolute inset-y-0 right-0 flex items-center pr-1 gap-1">
                    {rightElement}
                </div>
            )}
        </div>
    </div>
));

const SelectField: React.FC<{ label: string; value: string; onChange: (val: string) => void; options: string[]; disabled?: boolean; placeholder?: string; }> = ({ label, value, onChange, options, disabled = false, placeholder = "Sélectionner..." }) => (
    <div>
        <label className="bsport-label truncate">{label}</label>
        <select className={`bsport-select ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`} value={value || ''} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
            <option value="">{placeholder}</option>
            {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
    </div>
);

const WelcomeView: React.FC<WelcomeViewProps> = ({ onNavigate, parcels, activeParcelId, setActiveParcelId, settings, parcelManager, setNotification, searchTerm = '' }) => {
    const activeParcel = parcels.find(p => p.id === activeParcelId);
    const [showLocationModal, setShowLocationModal] = useState(false);
    const requisitionRef = useRef<HTMLInputElement>(null);
    const titreRef = useRef<HTMLInputElement>(null);
    const cinInputRef = useRef<HTMLInputElement>(null);
    const [isProcessingCIN, setIsProcessingCIN] = useState(false);
    
    const [editingRiverainId, setEditingRiverainId] = useState<number | null>(null);
    const [newRivSegment, setNewRivSegment] = useState('');
    const [newRivName, setNewRivName] = useState('');
    const [newRivConsistance, setNewRivConsistance] = useState('');
    const [newRivShowLimits, setNewRivShowLimits] = useState(true);
    const [newRivLimitDirection, setNewRivLimitDirection] = useState<'both' | 'start' | 'end' | 'none'>('both');
    const [newRivIsMitoyenne, setNewRivIsMitoyenne] = useState(false);

    const segmentsList = useMemo(() => {
        if (!activeParcel || activeParcel.points.length < 2) return [];
        return activeParcel.points.map((p, i) => {
            const nextIndex = (i + 1) % activeParcel.points.length;
            if (!activeParcel.points[nextIndex]) return null;
            if (i === activeParcel.points.length - 1 && activeParcel.points.length < 3) return null;
            return { label: `B${i + 1} - B${nextIndex + 1}`, value: `B${i + 1} - B${nextIndex + 1}` };
        }).filter(Boolean) as { label: string, value: string }[];
    }, [activeParcel]);

    const filteredParcels = useMemo(() => {
        if (!searchTerm) return parcels;
        const lowerTerm = searchTerm.toLowerCase();
        return parcels.filter(p => 
            p.name.toLowerCase().includes(lowerTerm) || 
            p.requisition?.toLowerCase().includes(lowerTerm) || 
            p.titre?.toLowerCase().includes(lowerTerm)
        );
    }, [parcels, searchTerm]);

    const handleUpdateMeta = (field: keyof Parcel, value: string) => {
        if (!activeParcelId) return;
        parcelManager.updateParcel(activeParcelId, { [field]: value });
    };

    const generateProjectName = (nature: string, requisition: string, titre: string) => {
        if (nature === 'BI' || nature === 'BC') return requisition ? `R${requisition}` : (activeParcel?.name || 'Projet');
        if (nature === 'MT') return titre ? `T${titre}` : (activeParcel?.name || 'Projet');
        return activeParcel?.name || 'Projet';
    };

    const handleNatureChange = (v: string) => {
        if (!activeParcelId || !activeParcel) return;
        const newName = generateProjectName(v, activeParcel.requisition || '', activeParcel.titre || '');
        parcelManager.updateParcel(activeParcelId, { nature: v, name: newName });
        setTimeout(() => {
            if (v === 'BI' || v === 'BC') requisitionRef.current?.focus();
            else if (v === 'MT') titreRef.current?.focus();
        }, 50);
    };

    const handleRequisitionChange = (v: string) => {
        if (!activeParcelId || !activeParcel) return;
        const updates: Partial<Parcel> = { requisition: v };
        if (activeParcel.nature === 'BI' || activeParcel.nature === 'BC') updates.name = generateProjectName(activeParcel.nature, v, activeParcel.titre || '');
        parcelManager.updateParcel(activeParcelId, updates);
    };

    const handleTitreChange = (v: string) => {
        if (!activeParcelId || !activeParcel) return;
        const updates: Partial<Parcel> = { titre: v };
        if (activeParcel.nature === 'MT') updates.name = generateProjectName(activeParcel.nature, activeParcel.requisition || '', v);
        parcelManager.updateParcel(activeParcelId, updates);
    };

    const handleAutoSituation = async () => {
        if (!activeParcel || activeParcel.points.length < 3) {
            if(setNotification) setNotification("Il faut au moins 3 bornes pour calculer le centre.", "error");
            return;
        }
        const centroid = calculateCentroid(activeParcel.points);
        if (!centroid) return;
        let wgs84Centroid = centroid;
        if (settings.coordinateSystem !== 'wgs84') {
            const transformed = coordinateTransformationService.transform(centroid, settings.coordinateSystem, 'wgs84');
            if (transformed) wgs84Centroid = transformed;
            else { if(setNotification) setNotification("Erreur de transformation.", "error"); return; }
        }
        if(setNotification) setNotification("Recherche de l'adresse...", "info");
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${wgs84Centroid.y}&lon=${wgs84Centroid.x}&zoom=18&addressdetails=1`);
            const data = await response.json();
            if (data && data.address) {
                const addr = data.address;
                const parts = [];
                
                // Tentative de détection de la Préfecture / Province
                const apiProvince = addr.province || addr.state || addr.region;
                let foundPrefecture = "Pre Inezgane-Ait Melloul"; // Fallback par défaut si rien n'est trouvé

                if (apiProvince) {
                    const normalizedApiProv = apiProvince.toLowerCase();
                    const matchedPref = Object.keys(MOROCCO_LOCATIONS).find(p => 
                        normalizedApiProv.includes(p.toLowerCase()) || p.toLowerCase().includes(normalizedApiProv)
                    );
                    if (matchedPref) foundPrefecture = matchedPref;
                    else foundPrefecture = apiProvince; // Utiliser la valeur de l'API si pas de correspondance exacte
                }
                parts.push(foundPrefecture);

                // Récupération intelligente de la Commune / C.T
                const rawCommune = addr.city || addr.town || addr.village || addr.municipality || addr.city_district;
                if (rawCommune) {
                     // Vérifier si c'est une commune connue pour cette préfecture (optionnel, mais sympa)
                     // Pour l'instant on garde la valeur API
                     parts.push(`C.T ${rawCommune}`);
                }
                
                // Récupération du Lieu-dit / Hay / Douar
                const quartier = addr.suburb || addr.neighbourhood || addr.quarter || addr.residential || addr.road || addr.hamlet || addr.isolated_dwelling;
                if (quartier) parts.push(quartier);
                
                if (parts.length > 0) {
                    const situationStr = parts.join(', ');
                    handleUpdateMeta('situation', situationStr);
                    if(setNotification) setNotification("Situation mise à jour.", "success");
                }
            }
        } catch (e) { console.error(e); }
    };

    const handleCINUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !activeParcelId) return;
        setIsProcessingCIN(true);
        if (setNotification) setNotification("Analyse IA en cours (Gemini)...", "info");
        try {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                const base64 = (reader.result as string).split(',')[1];
                try {
                    const info = await extractOwnerInfoFromImage({ inlineData: { data: base64, mimeType: file.type } });
                    const updates: Partial<Parcel> = {};
                    if (info.nom) updates.ownerNom = info.nom;
                    if (info.prenom) updates.ownerPrenom = info.prenom;
                    if (info.cin) updates.ownerCIN = info.cin;
                    if (info.validite) updates.ownerCINExpiry = info.validite;
                    if (info.adresse) updates.ownerAdresse = info.adresse;
                    parcelManager.updateParcel(activeParcelId, updates);
                    if (setNotification) setNotification("Données extraites via IA avec succès.", "success");
                } catch (error) {
                    console.error(error);
                    if (setNotification) setNotification("Erreur lors de l'analyse IA.", "error");
                } finally {
                    setIsProcessingCIN(false);
                }
            };
        } catch (error) {
            console.error(error);
            setIsProcessingCIN(false);
        }
        e.target.value = '';
    };

    const handleSaveRiverain = () => {
        if (!activeParcelId || !newRivSegment || !newRivName) return;
        const currentRiverains = activeParcel?.riverains || [];
        const riverainData = { segmentLabel: newRivSegment, name: newRivName, consistance: newRivConsistance || 'T.N', showLimitLines: newRivShowLimits, limitDirection: newRivLimitDirection, isMitoyenne: newRivIsMitoyenne };
        if (editingRiverainId !== null) {
            const updated = currentRiverains.map(r => r.id === editingRiverainId ? { ...r, ...riverainData } : r);
            parcelManager.updateParcel(activeParcelId, { riverains: updated });
        } else {
            const newRiverain = { id: Date.now(), ...riverainData };
            parcelManager.updateParcel(activeParcelId, { riverains: [...currentRiverains, newRiverain] });
        }
        setEditingRiverainId(null); setNewRivName(''); setNewRivConsistance(''); setNewRivShowLimits(true); setNewRivLimitDirection('both'); setNewRivIsMitoyenne(false); setNewRivSegment('');
    };

    const handleEditRiverain = (riv: Riverain) => {
        setEditingRiverainId(riv.id); setNewRivSegment(riv.segmentLabel); setNewRivName(riv.name); setNewRivConsistance(riv.consistance); setNewRivShowLimits(riv.showLimitLines ?? true); setNewRivLimitDirection(riv.limitDirection || 'both'); setNewRivIsMitoyenne(riv.isMitoyenne ?? false);
    };

    const handleDeleteRiverain = (rivId: number) => {
        if (!activeParcelId || !activeParcel) return;
        const updated = (activeParcel.riverains || []).filter(r => r.id !== rivId);
        parcelManager.updateParcel(activeParcelId, { riverains: updated });
    };

    return (
        <div className="relative h-full bg-[#F8FAFC] dark:bg-[#0F172A] overflow-y-auto scroll-smooth">
            <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-8">
                {/* En-tête + Carte principale */}
                <div className="bsport-card">
                    <div className="mb-8">
                        <h1 className="text-3xl md:text-4xl font-extrabold text-[#0F172A] dark:text-white tracking-tight">TOPOGAN <span className="font-light text-[#64748B]">Suite</span></h1>
                        <p className="mt-2 text-[15px] text-[#64748B] dark:text-[#94A3B8]">Outils de topographie foncière & plans cadastraux.</p>
                    </div>
                    <div className="pt-2">
                        <SectionHeader title="Fiche de la Parcelle Active" />
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                            <InputField label="Nom du Projet" value={activeParcel?.name || ''} onChange={(v) => handleUpdateMeta('name', v)} disabled={!activeParcel} />
                            <SelectField label="Nature" value={activeParcel?.nature || ''} onChange={handleNatureChange} options={NATURE_OPTIONS} disabled={!activeParcel} />
                            <InputField ref={requisitionRef} label="Réquisition" value={activeParcel?.requisition || ''} onChange={handleRequisitionChange} disabled={!activeParcel} />
                            <InputField ref={titreRef} label="Titre Foncier" value={activeParcel?.titre || ''} onChange={handleTitreChange} disabled={!activeParcel} />
                            
                            <InputField label="Propriété dite" value={activeParcel?.propriete || ''} onChange={(v) => handleUpdateMeta('propriete', v)} disabled={!activeParcel} />
                            <InputField label="Situation" value={activeParcel?.situation || ''} onChange={(v) => handleUpdateMeta('situation', v)} disabled={!activeParcel} rightElement={<div className="flex items-center gap-1 pr-1"><button onClick={handleAutoSituation} className="p-1.5 text-[#4F46E5] hover:bg-[#4F46E5]/10 rounded-lg transition-colors"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg></button><button onClick={() => setShowLocationModal(true)} className="p-1.5 text-[#64748B] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] rounded-lg transition-colors"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" /></svg></button></div>} />
                            <SelectField label="Consistance" value={activeParcel?.consistance || ''} onChange={(v) => handleUpdateMeta('consistance', v)} options={CONSISTANCE_OPTIONS} disabled={!activeParcel} />
                            <InputField label="Ingénieur G.T" value={activeParcel?.surveyor || ''} onChange={(v) => handleUpdateMeta('surveyor', v)} disabled={!activeParcel} />
                            
                            <div className="sm:col-span-2 lg:col-span-1 flex gap-3">
                                <InputField className="flex-grow" label="Date de Bornage" type="date" value={activeParcel?.date || ''} onChange={(v) => handleUpdateMeta('date', v)} disabled={!activeParcel} />
                                <InputField className="w-20" label="Heure" type="number" placeholder="HH" value={activeParcel?.bornageHour || ''} onChange={(v) => handleUpdateMeta('bornageHour', v)} disabled={!activeParcel} />
                                <InputField className="w-20" label="Min" type="number" placeholder="MM" value={activeParcel?.bornageMinute || ''} onChange={(v) => handleUpdateMeta('bornageMinute', v)} disabled={!activeParcel} />
                            </div>
                        </div>

                        <SectionHeader 
                            title="Informations Propriétaire" 
                            rightElement={
                                <div className="flex items-center">
                                    <input type="file" ref={cinInputRef} accept="image/*" className="hidden" onChange={handleCINUpload} />
                                    <button onClick={() => cinInputRef.current?.click()} className="flex items-center gap-1.5 text-[11px] font-bold text-[#4F46E5] dark:text-[#818CF8] bg-[#4F46E5]/10 hover:bg-[#4F46E5]/20 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50" disabled={!activeParcel || isProcessingCIN} title="Scanner une CIN (OCR IA)">
                                        {isProcessingCIN ? ( <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> ) : ( <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg> )} SCAN CIN (IA)
                                    </button>
                                </div>
                            }
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                            <InputField label="Nom" value={activeParcel?.ownerNom || ''} onChange={(v) => handleUpdateMeta('ownerNom', v)} disabled={!activeParcel} />
                            <InputField label="Prénom" value={activeParcel?.ownerPrenom || ''} onChange={(v) => handleUpdateMeta('ownerPrenom', v)} disabled={!activeParcel} />
                            <SelectField label="Qualité" value={activeParcel?.ownerQualite || ''} onChange={(v) => handleUpdateMeta('ownerQualite', v)} options={QUALITE_OPTIONS} disabled={!activeParcel} />
                            <InputField label="CIN N°" value={activeParcel?.ownerCIN || ''} onChange={(v) => handleUpdateMeta('ownerCIN', v)} disabled={!activeParcel} />
                            <InputField label="Valable jusqu'au" type="date" value={activeParcel?.ownerCINExpiry || ''} onChange={(v) => handleUpdateMeta('ownerCINExpiry', v)} disabled={!activeParcel} />
                            <InputField label="Adresse" value={activeParcel?.ownerAdresse || ''} onChange={(v) => handleUpdateMeta('ownerAdresse', v)} disabled={!activeParcel} />
                        </div>
                    </div>
                </div>

                {activeParcel && (
                    <div className="bsport-card">
                        <SectionHeader title="Gestion des Riverains" />
                        <div className="flex flex-col lg:flex-row gap-8">
                            <div className="w-full lg:w-1/3 space-y-5 bg-[#F8FAFC] dark:bg-[#1E293B] p-5 rounded-2xl h-fit border border-[#E2E8F0] dark:border-[#334155]">
                                <h4 className="text-[15px] font-bold text-[#0F172A] dark:text-white">{editingRiverainId ? 'Modifier Riverain' : 'Ajouter Riverain'}</h4>
                                <div className="space-y-4">
                                    <SelectField label="Segment" value={newRivSegment} onChange={setNewRivSegment} options={segmentsList.map(s => s.value)} />
                                    <InputField label="Riverain / Voie" value={newRivName} onChange={setNewRivName} />
                                    <InputField label="Consistance" value={newRivConsistance} onChange={setNewRivConsistance} />
                                    <button onClick={handleSaveRiverain} disabled={!newRivSegment || !newRivName} className="bsport-btn-primary w-full mt-2">Enregistrer</button>
                                </div>
                            </div>
                            <div className="w-full lg:w-2/3 overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-[11px] text-[#64748B] uppercase tracking-wider border-b border-[#E2E8F0] dark:border-[#334155]"><tr><th className="px-4 py-3 font-bold">Segment</th><th className="px-4 py-3 font-bold">Riverain</th><th className="px-4 py-3 text-right font-bold">Actions</th></tr></thead>
                                    <tbody className="divide-y divide-[#F1F5F9] dark:divide-[#1E293B]">
                                        {(activeParcel.riverains || []).map(riv => (
                                            <tr key={riv.id} className="hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]/50 transition-colors">
                                                <td className="px-4 py-4 font-mono font-bold text-[#4F46E5] dark:text-[#818CF8]">{riv.segmentLabel}</td>
                                                <td className="px-4 py-4"><div className="font-bold text-[#0F172A] dark:text-white">{riv.name}</div><div className="text-[13px] text-[#64748B] mt-0.5">{riv.consistance}</div></td>
                                                <td className="px-4 py-4 text-right space-x-1 whitespace-nowrap">
                                                    <button onClick={() => handleEditRiverain(riv)} className="p-2 text-[#4F46E5] hover:bg-[#4F46E5]/10 rounded-lg transition-colors"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                                                    <button onClick={() => handleDeleteRiverain(riv.id)} className="p-2 text-[#EF4444] hover:bg-[#EF4444]/10 rounded-lg transition-colors"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    <ToolCard title="Surface & Bornes" description="Calcul de contenance et saisie de coordonnées." icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>} onClick={() => onNavigate('SURFACE')} colorClass="text-[#4F46E5] bg-[#4F46E5]" />
                    <ToolCard title="Procès-Verbal" description="Générer le rapport officiel de bornage." icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>} onClick={() => onNavigate('TECHNICAL_PV')} colorClass="text-[#10B981] bg-[#10B981]" />
                    <ToolCard title="Carte Interactive" description="Mesures graphiques et visualisation globale." icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} onClick={() => onNavigate('MAP')} colorClass="text-[#06B6D4] bg-[#06B6D4]" />
                    <ToolCard title="Croquis de Bornage" description="Édition de croquis ST 180D." icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>} onClick={() => onNavigate('BORNAGE_SKETCH')} colorClass="text-[#F59E0B] bg-[#F59E0B]" />
                </div>

                <div className="bsport-card mb-16 md:mb-0">
                    <SectionHeader title="Mes Projets" />
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-[11px] text-[#64748B] uppercase tracking-wider bg-[#F8FAFC] dark:bg-[#1E293B]">
                                <tr><th className="px-5 py-3.5 font-bold rounded-tl-xl">Nom / Référence</th><th className="px-5 py-3.5 font-bold">Nature</th><th className="px-5 py-3.5 font-bold">Surface</th><th className="px-5 py-3.5 text-right font-bold rounded-tr-xl">Actions</th></tr>
                            </thead>
                            <tbody className="divide-y divide-[#F1F5F9] dark:divide-[#1E293B]">
                                {filteredParcels.map(p => {
                                    const area = calculatePolygonArea(p.points, settings.coordinateSystem);
                                    return (
                                        <tr key={p.id} className={`hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]/50 transition-colors ${activeParcelId === p.id ? 'bg-[#4F46E5]/5 dark:bg-[#4F46E5]/10' : ''}`}>
                                            <td className="px-5 py-4 font-bold text-[#0F172A] dark:text-white"><div className="flex items-center gap-3"><span className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: p.color }}></span>{p.name}</div></td>
                                            <td className="px-5 py-4 text-[#64748B]">{p.nature || '-'}</td>
                                            <td className="px-5 py-4 font-medium text-[#0F172A] dark:text-gray-300">{formatArea(area, settings.areaUnit, 0)}</td>
                                            <td className="px-5 py-4 text-right space-x-2 whitespace-nowrap">
                                                <button onClick={() => { setActiveParcelId(p.id); onNavigate('TECHNICAL_PV'); }} className="p-2 text-[#10B981] hover:bg-[#10B981]/10 rounded-lg transition-colors" title="Voir PV"><svg className="w-5 h-5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg></button>
                                                <button onClick={() => { setActiveParcelId(p.id); onNavigate('SURFACE'); }} className="p-2 text-[#4F46E5] hover:bg-[#4F46E5]/10 rounded-lg transition-colors" title="Voir Surface"><svg className="w-5 h-5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            {showLocationModal && <LocationSelectorModal onConfirm={(addr) => { handleUpdateMeta('situation', addr); setShowLocationModal(false); }} onClose={() => setShowLocationModal(false)} initialValue={activeParcel?.situation} />}
        </div>
    );
};

export default WelcomeView;
