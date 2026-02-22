import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Parcel, AppSettings, CalculationResults, Riverain } from '../types';
import { formatArea } from '../services/unitConversionService';

interface TechnicalPVViewProps {
    parcel?: Parcel;
    settings: AppSettings;
    results: CalculationResults | null;
    onClose: () => void;
}

// --- Helper Functions ---

const numberToFrench = (num: number): string => {
    const units = ["", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf"];
    const teens = ["dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];
    const tens = ["", "dix", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante-dix", "quatre-vingt", "quatre-vingt-dix"];

    if (num === 0) return ""; 
    if (num < 10) return units[num];
    if (num < 20) return teens[num - 10];
    
    const tenDigit = Math.floor(num / 10);
    const unitDigit = num % 10;

    if (tenDigit === 7) return `soixante-${unitDigit === 1 ? 'et-onze' : (teens[unitDigit] || 'dix')}`;
    if (tenDigit === 9) return `quatre-vingt-${teens[unitDigit] || 'dix'}`;
    
    let str = tens[tenDigit];
    if (tenDigit === 8) str += "s";
    
    if (unitDigit === 1 && tenDigit !== 8) str += " et un";
    else if (unitDigit > 0) {
            if (tenDigit === 8) str = "quatre-vingt";
            str += `-${units[unitDigit]}`;
    }
    return str;
};

const generateBorneAndLimitDescription = (parcelConsistance: string, riverain: Riverain) => {
    const pCons = (parcelConsistance || '').toUpperCase();
    const rCons = (riverain.consistance || '').toUpperCase();
    const rName = (riverain.name || '').toUpperCase();

    const builtKeywords = ['RDC', 'R+', 'MAISON', 'VILLA', 'CONST', 'BATI', 'MAGASIN', 'TC', 'T.N.C', 'T.C', 'CLOTURE'];
    
    const isParcelBuilt = builtKeywords.some(k => pCons.includes(k));
    const isRivBuilt = builtKeywords.some(k => rCons.includes(k));
    
    const isParcelTN = !isParcelBuilt;
    const isRivTN = !isRivBuilt;
    const isRivVoirie = rName.includes('RUE') || rName.includes('VOIE') || rName.includes('PISTE') || rCons.includes('VOIE') || rCons.includes('DOMAINE PUBLIC');

    let borneText = "Borne plantée"; 
    let limitText = "L.R en T.N";

    if (isParcelBuilt || isRivBuilt) {
        borneText = "Borne marquée";
    }

    if (isParcelTN && isRivTN) {
        limitText = "L.R en T.N";
    } else if (isParcelBuilt && isRivBuilt) {
        limitText = "L.R suivant la ligne d'accolement de deux murs, un à la Pté l'autre au riverain";
    } else if (isParcelBuilt && (isRivTN || isRivVoirie)) {
        limitText = "L.R suivant le parement extérieur d'un mur à la Pté";
    } else if (isParcelTN && isRivBuilt) {
        limitText = "L.R suivant le parement extérieur du mur du riverain";
    }

    return `${borneText}\n${limitText}`;
};

const isRiverainVoirie = (name: string, consistance: string) => {
    const keywords = ['VOIE', 'RUE', 'AVENUE', 'BOULEVARD', 'PISTE', 'ROUTE', 'CHEMIN', 'DOMAINE PUBLIC'];
    const n = (name || '').toUpperCase();
    const c = (consistance || '').toUpperCase();
    return keywords.some(k => n.includes(k) || c.includes(k));
};

// --- Sub-components ---

const DottedInput = ({ value, onChange, width = "flex-grow", center = true, style = {}, isExporting = false }: any) => (
    <div className={`border-b border-dotted border-gray-400 px-1 mx-0.5 ${width} inline-block relative top-0.5`} style={style.borderBottom === 'none' ? {borderBottom: 'none'} : {}}>
        {isExporting ? (
            <span 
                className={`w-full block bg-transparent border-none p-0 text-black font-bold text-[12px] ${center ? 'text-center' : 'text-left'} leading-none font-serif`}
                style={{...style, minHeight: '14px', lineHeight: '1.2'}}
            >
                {value}
            </span>
        ) : (
            <input 
                value={value} 
                onChange={(e) => onChange(e.target.value)}
                className={`w-full bg-transparent border-none p-0 focus:ring-0 text-black font-bold text-[12px] ${center ? 'text-center' : 'text-left'} h-4 leading-none font-serif`}
                style={style}
                spellCheck={false}
            />
        )}
    </div>
);

const DottedTextArea = ({ value, onChange, lines = 5, className = "", lineHeight = "1.8em", isExporting = false, showLines = true }: any) => (
    <div className={`relative w-full ${className}`}>
        {showLines && (
            <div className="absolute inset-0 pointer-events-none">
                {Array.from({ length: lines }).map((_, i) => (
                    <div key={i} className="border-b border-dotted border-gray-400" style={{ height: lineHeight }}></div>
                ))}
            </div>
        )}
        {isExporting ? (
            <div 
                className="relative w-full bg-transparent border-none p-0 text-black font-bold text-[12px] font-serif whitespace-pre-wrap leading-tight"
                style={{ 
                    lineHeight: lineHeight, 
                    minHeight: `calc(${lines} * ${lineHeight})`,
                    height: showLines ? `calc(${lines} * ${lineHeight})` : 'auto',
                    overflow: showLines ? 'hidden' : 'visible'
                }}
            >
                {value}
            </div>
        ) : (
            <textarea 
                value={value} 
                onChange={(e) => onChange(e.target.value)}
                rows={lines}
                className="relative w-full bg-transparent border-none p-0 focus:ring-0 text-black font-bold text-[12px] resize-none overflow-hidden font-serif leading-tight"
                style={{ lineHeight: lineHeight }}
                spellCheck={false}
            />
        )}
    </div>
);

const TechnicalPVView: React.FC<TechnicalPVViewProps> = ({ parcel, settings, results, onClose }) => {
    const [zoom, setZoom] = useState(0.25);
    const [isExporting, setIsExporting] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    
    const [riverainRows, setRiverainRows] = useState<Record<number, { presence: string, description: string }>>({});

    const [pvData, setPvData] = useState({
        conservation: 'INEZGANE',
        requisitionNo: '',
        piecesAnnexes: '',
        references4: '',
        dateAn: '........................', 
        dateMoisJour: '............................................', 
        heureText: '......................', 
        minuteText: '......................', 
        proprietaireNom: '',
        proprieteDite: '',
        proprietaireDemeurant: '',
        vu: '',
        presentsMM3: '',
        limitesGeneralesExtra: 'une seule parcelle à l’extrait de Réquisition.',
        departBornage2: 'L’angle N.O',
        suiteOperations: 'plantant',
        borneDepartNo: '1',
        incidentsRecap: 'Néant.',
        droitsReelsRecap: 'Néant.',
        declarationsMentions: '',
        natureConsistance1: '',
        rayesNuls: '........',
        misEnInterligne: '........',
        surveyorName: '',
        surveyorQualite: 'technicien topographe assermenté, titulaire délégué de Mr le conservateur d\'Inezgane',
        cloturePvPar: ''
    });

    useEffect(() => {
        if (containerRef.current) {
            const { clientWidth } = containerRef.current;
            const fitScale = (clientWidth - 48) / 1587; 
            setZoom(Math.min(Math.max(fitScale, 0.15), 1.0));
        }
    }, []);

    useEffect(() => {
        if (parcel) {
            const situationParts = parcel.situation?.split(',') || [];
            
            let anneeTxt = '........................';
            let moisJourTxt = '............................................';
            let heureTxt = '......................';
            let minuteTxt = '......................';

            if (parcel.date) {
                const d = new Date(parcel.date);
                if (!isNaN(d.getTime())) {
                    const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
                    const day = d.getDate();
                    const month = months[d.getMonth()];
                    const year = d.getFullYear();
                    
                    const dayTxt = day === 1 ? 'premier' : numberToFrench(day);
                    moisJourTxt = `${dayTxt} ${month}`;
                    anneeTxt = numberToFrench(year % 100);
                }
            }

            if (parcel.bornageHour) {
                const h = parseInt(parcel.bornageHour);
                if (!isNaN(h)) heureTxt = h === 0 ? "minuit" : (h === 12 ? "midi" : numberToFrench(h));
            }

            if (parcel.bornageMinute) {
                const m = parseInt(parcel.bornageMinute);
                if (!isNaN(m)) minuteTxt = m === 0 ? "zéro" : numberToFrench(m);
            }

            let presentsText = '';
            if (parcel.ownerNom || parcel.ownerPrenom) {
                const nom = parcel.ownerNom?.toUpperCase() || '';
                const prenom = parcel.ownerPrenom || '';
                const qualite = parcel.ownerQualite ? `(${parcel.ownerQualite})` : '';
                const formatDateSimple = (d: string) => {
                    if (!d) return '....................';
                    const parts = d.split('-'); 
                    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
                    return d;
                };
                const cin = parcel.ownerCIN || '..........';
                const cinDate = formatDateSimple(parcel.ownerCINExpiry || '');
                const adresse = parcel.ownerAdresse || parcel.situation || '..........';
                presentsText = `${nom} ${prenom} ${qualite}\nCIN N° ${cin} valable jusqu'au ${cinDate} demeurant ${adresse}`;
            }

            const initialRows: Record<number, { presence: string, description: string }> = {};
            if (parcel.riverains) {
                parcel.riverains.forEach(riv => {
                    initialRows[riv.id] = {
                        presence: 'A', 
                        description: generateBorneAndLimitDescription(parcel.consistance || 'TN', riv)
                    };
                });
                setRiverainRows(initialRows);
            }

            const consistanceOnly = (parcel.consistance || 'Terrain Nu (T.N)').trim();
            const isBuilt = ['RDC', 'R+', 'BATI', 'MAISON', 'VILLA'].some(k => consistanceOnly.toUpperCase().includes(k));

            setPvData(prev => ({
                ...prev,
                conservation: situationParts[0]?.trim() || prev.conservation,
                requisitionNo: parcel.requisition || '',
                natureConsistance1: consistanceOnly,
                proprieteDite: parcel.propriete || parcel.name || '',
                proprietaireNom: (parcel.ownerNom || parcel.ownerPrenom) 
                    ? `${parcel.ownerNom || ''} ${parcel.ownerPrenom || ''} (${parcel.ownerQualite || ''})`.trim() 
                    : '',
                proprietaireDemeurant: parcel.ownerAdresse || parcel.situation || '',
                dateAn: anneeTxt !== '........................' ? anneeTxt : prev.dateAn,
                dateMoisJour: moisJourTxt !== '............................................' ? moisJourTxt : prev.dateMoisJour,
                heureText: heureTxt !== '......................' ? heureTxt : prev.heureText,
                minuteText: minuteTxt !== '......................' ? minuteTxt : prev.minuteText,
                surveyorName: parcel.surveyor || '',
                presentsMM3: presentsText || prev.presentsMM3,
                suiteOperations: isBuilt ? 'marquant' : 'plantant'
            }));
        }
    }, [parcel]);

    const handleRiverainChange = (id: number, field: 'presence' | 'description', value: string) => {
        setRiverainRows(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
    };

    if (!parcel) return null;

    const isRepresentant = parcel.ownerQualite?.toLowerCase().includes('représentant') || parcel.ownerQualite?.toLowerCase().includes('representant');

    const handlePrint = () => window.print();

    const handleExportPdf = async () => {
        if (isExporting) return;
        setIsExporting(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 500));
            const sheets = containerRef.current?.querySelectorAll('.a3-sheet');
            if (!sheets) return;
            const originalStyles: { transform: string; margin: string; boxShadow: string }[] = [];
            sheets.forEach((sheet) => {
                const el = sheet as HTMLElement;
                originalStyles.push({ 
                    transform: el.style.transform, 
                    margin: el.style.margin,
                    boxShadow: el.style.boxShadow 
                });
                el.style.transform = 'none';
                el.style.margin = '0';
                el.style.boxShadow = 'none';
            });

            const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
            for (let i = 0; i < sheets.length; i++) {
                const sheet = sheets[i] as HTMLElement;
                const canvas = await html2canvas(sheet, { 
                    scale: 4, 
                    useCORS: true, 
                    backgroundColor: '#ffffff', 
                    logging: false,
                    allowTaint: true,
                    onclone: (clonedDoc) => {
                        const inputs = clonedDoc.querySelectorAll('input');
                        inputs.forEach((input: any) => input.setAttribute('value', input.value));
                        const textareas = clonedDoc.querySelectorAll('textarea');
                        textareas.forEach((area: any) => area.innerHTML = area.value);
                    }
                });
                if (i > 0) pdf.addPage('a3', 'landscape');
                pdf.addImage(canvas.toDataURL('image/jpeg', 1.0), 'JPEG', 0, 0, 420, 297);
            }
            sheets.forEach((sheet, i) => {
                const el = sheet as HTMLElement;
                el.style.transform = originalStyles[i].transform;
                el.style.margin = originalStyles[i].margin;
                el.style.boxShadow = originalStyles[i].boxShadow;
            });
            pdf.save(`PV_Bornage_${parcel.name.replace(/\s+/g, '_')}.pdf`);
        } catch (error) {
            console.error("Erreur export PDF:", error);
            alert("Une erreur est survenue lors de la génération du PDF.");
        } finally { 
            setIsExporting(false); 
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 overflow-hidden select-text">
            <div className="flex items-center justify-between p-4 bg-white/95 border-b border-gray-300 z-50 no-print shadow-md">
                <div className="flex items-center gap-6">
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                    </button>
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Zoom PV</span>
                        <input type="range" min="0.1" max="1.5" step="0.05" value={zoom} onChange={(e) => setZoom(parseFloat(e.target.value))} className="w-32 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={handleExportPdf} disabled={isExporting} className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg transition-all disabled:bg-gray-400">
                        {isExporting ? 'Génération...' : 'PDF'}
                    </button>
                    <button onClick={handlePrint} className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-xl transition-all">
                        Imprimer
                    </button>
                </div>
            </div>

            <style>{`
                @media print {
                    .no-print { display: none !important; }
                    body { background: white !important; margin: 0 !important; padding: 0 !important; }
                    .a3-sheet { width: 420mm !important; height: 297mm !important; page-break-after: always; box-shadow: none !important; margin: 0 !important; display: flex !important; transform: none !important; }
                    @page { margin: 0; size: A3 landscape; }
                }
                .pv-font { font-family: "Times New Roman", Times, serif; color: black; line-height: 1.1; font-size: 12px; }
                .sheet-side { width: 50%; height: 100%; position: relative; display: flex; flex-direction: column; border-right: 0.1mm solid #ddd; }
                .sheet-side-content { padding: 8mm 8mm; height: 100%; display: flex; flex-direction: column; }
                .sheet-side:last-child { border-right: none; }
                .official-title { padding: 5px 0; margin: 5px 0 15px 0; text-align: center; }
                .official-title h1 { font-size: 24pt; font-weight: 900; font-style: italic; font-family: "Arial Black", Arial, sans-serif; margin-bottom: 0; letter-spacing: -1px; }
                .footnote { font-size: 7.5px; line-height: 1.1; margin-bottom: 2px; text-align: justify; }
                .situation-container { border-left: 1.5pt solid black; padding-left: 8px; position: relative; margin-top: 2px; display: flex; flex-direction: column; justify-content: space-between; height: 65px; }
                .situation-brace-label { position: absolute; left: -30px; top: 50%; transform: translateY(-50%); font-size: 10px; width: 25px; text-align: right; line-height: 1.1; }
                .table-bordered { width: 100%; border-collapse: collapse; border: 1.5pt solid black; }
                .table-bordered th, .table-bordered td { border: 1pt solid black; padding: 3px; vertical-align: top; }
                .table-bordered th { font-size: 9px; font-weight: bold; text-transform: uppercase; background: #f8f8f8; text-align: center; }
                .page1-split { display: flex; height: 100%; }
                .page1-left-col { width: 22%; border-right: none; padding: 8mm 2mm; display: flex; flex-direction: column; align-items: center; border-right: 0.5pt solid rgba(0,0,0,0.1); }
                .page1-right-col { width: 78%; padding: 8mm 6mm; display: flex; flex-direction: column; position: relative; }
            `}</style>

            <div ref={containerRef} className="flex-1 overflow-auto flex flex-col py-12 gap-16 w-full relative">
                {/* FEUILLET 1 : RECTO (PAGE 4 | PAGE 1) */}
                <div className="relative bg-white shadow-2xl transition-all duration-300 origin-top mx-auto" style={{ width: `${420 * zoom}mm`, height: `${297 * zoom}mm`, flexShrink: 0 }}>
                    <div className="a3-sheet bg-white flex flex-row pv-font absolute top-0 left-0" style={{ width: '420mm', height: '297mm', transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
                        {/* PAGE 4 (GAUCHE) */}
                        <div className="sheet-side">
                            <div className="sheet-side-content">
                                <div className="flex-1">
                                    <h3 className="text-center font-bold text-[13px] uppercase underline mb-1">Incidents, Oppositions ou Revendications (1)</h3>
                                    <p className="text-center text-[9px] italic mb-3">(Récapitulation)</p>
                                    <DottedTextArea value={pvData.incidentsRecap} onChange={(v:any)=>setPvData({...pvData, incidentsRecap:v})} lines={22} lineHeight="2.1em" isExporting={isExporting} />
                                </div>
                                <div className="flex-1 mt-6">
                                    <h3 className="text-center font-bold text-[13px] uppercase underline mb-1">Droits réels (Servitudes, Charges foncières (2), etc...)</h3>
                                    <p className="text-center text-[9px] italic mb-3">(Récapitulation)</p>
                                    <DottedTextArea value={pvData.droitsReelsRecap} onChange={(v:any)=>setPvData({...pvData, droitsReelsRecap:v})} lines={14} lineHeight="2.1em" isExporting={isExporting} />
                                </div>
                                <div className="mt-auto pt-3 border-t border-black/20">
                                    <p className="footnote">(1) Récapituler sommairement et au bureau le cas échéant, tous les incidents, oppositions, revendications ou interventions en renvoyant aux mentions portées dans le corps du procès-verbal, aux annexes signées des intéressés et à la description des revendications bornées.</p>
                                    <p className="footnote">(2) Mitoyennetés, droits de passage, de vues, d'eau, égouts des toits, etc...</p>
                                </div>
                            </div>
                        </div>

                        {/* PAGE 1 (DROITE) */}
                        <div className="sheet-side">
                            <div className="page1-split">
                                <div className="page1-left-col text-center">
                                    <div className="space-y-0.5 mb-2 w-full">
                                        <p className="font-bold text-[8pt] mb-1 font-serif tracking-tight uppercase">Royaume du Maroc</p>
                                        <div className="h-[2.5pt] w-12 bg-black mx-auto mb-2"></div>
                                        <p className="font-bold text-[6.5pt] leading-[1.3] font-serif uppercase">Agence Nationale de la Conservation Foncière<br/>du Cadastre et de la Cartographie</p>
                                        <div className="h-[0.5pt] w-12 bg-black/50 mx-auto my-3"></div>
                                        
                                        <p className="font-bold text-[8.5pt] font-serif tracking-tight uppercase">Conservation Foncière</p>
                                        <div className="flex items-center justify-center gap-1 mt-0.5 flex-nowrap w-full">
                                            <span className="text-[8.5pt] font-serif italic">d’</span>
                                            <DottedInput value={pvData.conservation} onChange={(v:any)=>setPvData({...pvData, conservation:v})} width="w-36" center style={{ fontSize: '9pt', fontWeight: '900', borderBottom: 'none' }} isExporting={isExporting} />
                                        </div>
                                        <div className="h-[1.5pt] w-12 bg-black mx-auto mt-2"></div>
                                    </div>

                                    <div className="w-full text-center space-y-1 mb-6 mt-10 px-1">
                                        <p className="font-bold text-[9pt] font-serif tracking-tight uppercase">Réquisition d'Immatriculation</p>
                                        <div className="h-[0.8pt] w-10 bg-black mx-auto mt-0.5 mb-1.5"></div>
                                        <div className="flex items-center justify-center font-bold text-[10pt] font-serif">N° <DottedInput value={pvData.requisitionNo} onChange={(v:any)=>setPvData({...pvData, requisitionNo:v})} width="w-48" style={{fontSize: '10pt'}} isExporting={isExporting} /></div>
                                        <div className="h-[1.5pt] w-12 bg-black mx-auto mt-3"></div>
                                    </div>

                                    <div className="w-full text-left space-y-2 flex-grow px-1">
                                        <div className="flex items-center text-[7.5pt] mb-1 justify-center relative">
                                            <div className="h-[0.6pt] w-12 bg-black absolute left-0 top-1/2 -translate-y-1/2"></div>
                                            <span className="shrink-0 font-bold font-serif ml-14 underline uppercase">Pièces annexées</span>
                                        </div>
                                        <div className="flex items-center justify-center text-[10pt] font-serif mb-3 mt-6">
                                            <span className="shrink-0 font-bold uppercase">Références (4)</span>
                                        </div>
                                        <div className="mt-8 space-y-4 opacity-70">
                                            {Array.from({length: 8}).map((_, i) => (
                                                <div key={i} className="border-b border-dotted border-gray-700 w-full h-0.5"></div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="w-full text-justify text-[6.5pt] space-y-1.5 mt-4 pt-2 border-t border-black/20 leading-[1.3] px-1 font-serif">
                                        <p><strong>(1)</strong> Prendre renseignements exacts près des autorités locales et personnes présentes. Etablir la situation de l'immeuble en se conformant aux prescriptions de l'art. 21 de l'instruction sur les bornages.</p>
                                        <p><strong>(2)</strong> Voir alinéa 1<sup>er</sup> de l'art. 22 de l'instruction précitée.</p>
                                        <p><strong>(3)</strong> Noms, prénoms, qualités et domiciles de toutes les personnes intéressées par le bornage et de tous les assistants à inscrire successivement au moment où ils se présentent.</p>
                                        <p className="pl-3">Se conformer aux art. 22, 23, 24, 25 de l'instruction précitée, spécialement en ce qui concerne les qualités des personnes et leur représentation.</p>
                                        <p><strong>(4)</strong> Rappel des procès-verbaux complémentaires établis dans la suite.</p>
                                        <p className="mt-2 font-serif uppercase"><strong className="font-black">NOTA.</strong> - Si l'espace réservé ci-contre est insuffisant pour l'inscription de toutes les personnes intéressées, la liste en est continuée sur une feuille blanche, du format du procès-verbal, annexée à celui-ci.</p>
                                    </div>
                                </div>

                                <div className="page1-right-col">
                                    <div className="absolute top-4 right-4 text-[9pt] font-bold">I. F. 84 A</div>
                                    <div className="official-title mt-28">
                                        <h1>PROCES -VERBAL DE BORNAGE</h1>
                                    </div>
                                    <div className="text-[13px] font-bold mb-5 flex items-baseline">
                                        <span className="shrink-0 mr-3">de la propriété dite :</span>
                                        <DottedInput value={pvData.proprieteDite} onChange={(v:any)=>setPvData({...pvData, proprieteDite:v})} isExporting={isExporting} />
                                    </div>
                                    <div className="space-y-3 text-[12px] pl-4">
                                        <div className="flex items-start relative ml-8">
                                            <div className="situation-brace-label">
                                                <div>Située</div>
                                                <div>à (1)</div>
                                            </div>
                                            <div className="situation-container flex-grow w-full">
                                                <div className="flex items-center flex-nowrap"><span className="w-36 shrink-0 text-[11px] whitespace-nowrap">Province ou Préfecture :</span><DottedInput value={parcel.situation?.split(',')[0]} onChange={()=>{}} isExporting={isExporting} /></div>
                                                <div className="flex items-center flex-nowrap"><span className="w-36 shrink-0 text-[11px] whitespace-nowrap">Cercle, commune, ville :</span><DottedInput value={parcel.situation?.split(',')[1]} onChange={()=>{}} isExporting={isExporting} /></div>
                                                <div className="flex items-center flex-nowrap"><span className="w-36 shrink-0 text-[11px] whitespace-nowrap">Lieu-dit ou rue :</span><DottedInput value={parcel.situation?.split(',')[2]} onChange={()=>{}} isExporting={isExporting} /></div>
                                            </div>
                                        </div>
                                        <div className="mt-6 leading-[2.4] text-[13px]">
                                            <div className="flex items-baseline flex-nowrap">
                                                <span className="whitespace-nowrap mr-2">L'an deux mille :</span>
                                                <DottedInput value={pvData.dateAn} onChange={(v:any)=>setPvData({...pvData, dateAn:v})} width="w-40" isExporting={isExporting} />
                                                <span className="whitespace-nowrap mx-2">, le</span>
                                                <DottedInput value={pvData.dateMoisJour} onChange={(v:any)=>setPvData({...pvData, dateMoisJour:v})} width="flex-grow" isExporting={isExporting} />
                                            </div>
                                            <div className="flex items-baseline flex-nowrap">
                                                <span className="whitespace-nowrap mr-2">à</span>
                                                <DottedInput value={pvData.heureText} onChange={(v:any)=>setPvData({...pvData, heureText:v})} width="w-32" isExporting={isExporting} />
                                                <span className="whitespace-nowrap mx-2">heures</span>
                                                <DottedInput value={pvData.minuteText} onChange={(v:any)=>setPvData({...pvData, minuteText:v})} width="w-32" isExporting={isExporting} />
                                                <span className="whitespace-nowrap mx-2">minutes</span>
                                                <span className="whitespace-nowrap text-[11px] ml-2">(en toutes lettres)</span>
                                            </div>
                                            <div className="mt-3 flex items-baseline flex-nowrap">
                                                <span className="font-bold mr-2 whitespace-nowrap">Devant Nous soussigné,</span>
                                                <DottedInput value={pvData.surveyorName} onChange={(v:any)=>setPvData({...pvData, surveyorName:v})} isExporting={isExporting} />
                                            </div>
                                            <DottedTextArea value={pvData.surveyorQualite} onChange={(v:any)=>setPvData({...pvData, surveyorQualite:v})} lines={2} lineHeight="2.4em" isExporting={isExporting} />
                                            <div className="mt-1 flex items-baseline flex-nowrap">
                                                <span className="mr-2 whitespace-nowrap">En vue de procéder au bornage de la propriété dite</span>
                                                <DottedInput value={pvData.proprieteDite} onChange={(v:any)=>setPvData({...pvData, proprieteDite:v})} isExporting={isExporting} />
                                            </div>
                                            <div className="flex items-baseline mt-1 flex-nowrap">
                                                <span className="mr-2 whitespace-nowrap">dont l'immatriculation a été requise sous le n°</span>
                                                <DottedInput value={pvData.requisitionNo} onChange={(v:any)=>setPvData({...pvData, requisitionNo:v})} width="w-24" isExporting={isExporting} />
                                                <span className="mx-2 whitespace-nowrap">par</span>
                                                <span className="font-bold mr-2 whitespace-nowrap">M (2)</span>
                                                <DottedInput value={pvData.proprietaireNom} onChange={(v:any)=>setPvData({...pvData, proprietaireNom:v})} isExporting={isExporting} />
                                            </div>
                                            <div className="flex items-baseline mt-1 flex-nowrap">
                                                <span className="mr-2 whitespace-nowrap">demeurant à</span>
                                                <DottedInput value={pvData.proprietaireDemeurant} onChange={(v:any)=>setPvData({...pvData, proprietaireDemeurant:v})} isExporting={isExporting} />
                                            </div>
                                            <div className="flex items-baseline mt-1 flex-nowrap">
                                                <span className="mr-2 whitespace-nowrap">Vu</span>
                                                <DottedInput value={pvData.vu} onChange={(v:any)=>setPvData({...pvData, vu:v})} isExporting={isExporting} />
                                            </div>
                                            <DottedTextArea value="" onChange={()=>{}} lines={1} lineHeight="2.4em" isExporting={isExporting} />
                                        </div>
                                        <div className="mt-4 text-justify text-[12px] leading-relaxed">
                                            Attendu que tous les intéressés ont été prévenus, ainsi qu'il est prescrit par le Dahir sur la Propriété Foncière, suivant publications et convocations régulières ;
                                            <br/>
                                            Nous nous sommes transporté sur la dite propriété et y avons trouvé :
                                        </div>
                                        <div className="mt-2 flex items-start h-full">
                                            <span className="font-bold text-[12px] uppercase mt-2 mr-3">MM. (3)</span>
                                            <DottedTextArea value={pvData.presentsMM3} onChange={(v:any)=>setPvData({...pvData, presentsMM3:v})} lines={14} lineHeight="2.1em" isExporting={isExporting} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* FEUILLET 2 : VERSO (PAGE 2 | PAGE 3) */}
                <div 
                    className="relative bg-white shadow-2xl transition-all duration-300 origin-top mx-auto"
                    style={{ width: `${420 * zoom}mm`, height: `${297 * zoom}mm`, flexShrink: 0 }}
                >
                    <div 
                        className="a3-sheet bg-white flex flex-row pv-font absolute top-0 left-0"
                        style={{ width: '420mm', height: '297mm', transform: `scale(${zoom})`, transformOrigin: 'top left' }}
                    >
                    {/* PAGE 2 (GAUCHE) */}
                    <div className="sheet-side">
                        <div className="sheet-side-content">
                            <div className="mb-4 space-y-2 text-[12.5px] leading-[1.8] font-serif pt-4 px-2">
                                <div>
                                    <span className="inline-block">Après nous être rendu compte des limites générales de l'immeuble à borner (1) :</span>
                                    <div className="w-full">
                                        <DottedInput value={pvData.limitesGeneralesExtra} onChange={(v:any)=>setPvData({...pvData, limitesGeneralesExtra:v})} width="w-full" center={false} isExporting={isExporting} />
                                    </div>
                                </div>
                                <div className="flex items-baseline mt-1">
                                    <span className="whitespace-nowrap mr-2">nous prenons comme point de départ de nos opérations (2) :</span>
                                    <DottedInput value={pvData.departBornage2} onChange={(v:any)=>setPvData({...pvData, departBornage2:v})} width="flex-grow" isExporting={isExporting} />
                                </div>
                                <div className="flex items-baseline mt-1">
                                    <span className="whitespace-nowrap mr-2">et nous y</span>
                                    <DottedInput value={pvData.suiteOperations} onChange={(v:any)=>setPvData({...pvData, suiteOperations:v})} width="w-28" isExporting={isExporting} />
                                    <span className="whitespace-nowrap mx-2">la borne n°</span>
                                    <DottedInput value={pvData.borneDepartNo} onChange={(v:any)=>setPvData({...pvData, borneDepartNo:v})} width="w-16" isExporting={isExporting} />
                                </div>
                            </div>

                            <div className="flex-grow mt-2 relative border-[2px] border-black flex flex-col">
                                {/* Header */}
                                <div className="flex border-b-[2px] border-black text-[10px] text-center h-auto">
                                    <div className="w-[35%] border-r border-black p-2 flex flex-col justify-center">
                                        <div className="font-bold uppercase text-[12px] mb-2">RIVERAINS (3)</div>
                                        <div className="text-[8px] leading-tight">Nom des propriétaires riverains, avec leur adresse, s'il y a lieu.<br/>Désignation des tenants et aboutissants.</div>
                                    </div>
                                    <div className="w-[12%] border-r border-black p-1 flex flex-col justify-center">
                                        <div className="font-bold mb-2 leading-tight">Indication<br/>constatant la<br/>présence<br/>ou l'absence<br/>des riverains :</div>
                                    </div>
                                    <div className="w-[10%] border-r border-black p-1 flex flex-col justify-center">
                                        <div className="font-bold text-[11px] leading-tight">NUMERO<br/>DES<br/>BORNES<br/>(4)</div>
                                    </div>
                                    <div className="w-[43%] p-2 flex flex-col justify-center">
                                        <div className="font-bold uppercase text-[11px] mb-2">NATURE DES BORNES ET DES LIMITES</div>
                                        <div className="text-[8px] leading-tight text-justify">Bornes communes avec propriétés riveraines déjà bornées (5)<br/>(propriétés privées, domaine public, immeubles domaniaux, biens collectifs) Droits réels et servitudes révélés<br/>Mentionner au fur et à mesure les incidents ou interventions des tiers avec références aux annexes, les suspensions et reprises de bornages</div>
                                    </div>
                                </div>

                                {/* Body */}
                                <div className="flex-grow flex relative min-h-[400px]">
                                    <div className="absolute inset-0 flex pointer-events-none">
                                        <div className="w-[35%] border-r border-black h-full"></div>
                                        <div className="w-[12%] border-r border-black h-full"></div>
                                        <div className="w-[10%] border-r border-black h-full"></div>
                                        <div className="w-[43%] h-full"></div>
                                    </div>

                                    <div className="w-full flex flex-col">
                                        {parcel.riverains && parcel.riverains.length > 0 ? (
                                            parcel.riverains.map((riv, i) => {
                                                const description = riverainRows[riv.id]?.description || '';
                                                const charCount = description.length;
                                                const estimatedWrapLines = Math.ceil(charCount / 35); 
                                                const explicitLines = description.split('\n').length;
                                                const descLines = Math.max(3, Math.max(explicitLines, estimatedWrapLines));
                                                const isRivVoirie = isRiverainVoirie(riv.name, riv.consistance);

                                                return (
                                                <React.Fragment key={riv.id}>
                                                    <div className={`flex text-[10px] min-h-[44px]`}>
                                                        <div className="w-[35%] p-2 flex flex-col items-center justify-start pt-8 text-center border-t border-dotted border-gray-300 self-stretch">
                                                            <div className="font-bold uppercase leading-tight relative z-10">{riv.name}</div>
                                                            {!isRivVoirie && <div className="italic text-[9px] leading-tight relative z-10 mt-0.5">{riv.consistance}</div>}
                                                        </div>
                                                        <div className="w-[12%] p-1 flex items-center justify-start pt-8 self-stretch">
                                                            <DottedInput 
                                                                value={riverainRows[riv.id]?.presence || 'A'} 
                                                                onChange={(v: string) => handleRiverainChange(riv.id, 'presence', v)} 
                                                                center 
                                                                width="w-full"
                                                                style={{ fontWeight: 'bold', color: '#1e3a8a', borderBottom: 'none', textAlign: 'center' }}
                                                                isExporting={isExporting}
                                                            />
                                                        </div>
                                                        <div className="w-[10%] p-1 text-center font-mono font-bold flex flex-col justify-start pt-3 items-center self-stretch">
                                                            {riv.segmentLabel.split(' - ')[0]}
                                                        </div>
                                                        <div className="w-[43%] p-2 italic flex items-start self-stretch">
                                                            <DottedTextArea 
                                                                value={description} 
                                                                onChange={(v: string) => handleRiverainChange(riv.id, 'description', v)} 
                                                                lines={descLines} 
                                                                lineHeight="1.2em"
                                                                className="text-justify"
                                                                isExporting={isExporting}
                                                                showLines={false}
                                                            />
                                                        </div>
                                                    </div>
                                                </React.Fragment>
                                                );
                                            })
                                        ) : (
                                            <div className="flex text-[10px] min-h-[24px]">
                                                <div className="w-[35%]"></div><div className="w-[12%]"></div><div className="w-[10%]"></div><div className="w-[43%]"></div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-auto pt-2 border-t border-black/20 text-[7px] text-justify space-y-0.5 leading-tight">
                                <p>(1) Se référer à l'art. 26 de l'Instruction. Voir les chevauchements interdits (art. 29).</p>
                                <p>Noter, s'il y a lieu, sur la ligne suivante, le nombre de parcelles dont se compose la propriété (art. 27) et le nombre d'enclaves (art. 28) les décrire successivement.</p>
                                <p>(2) Se référer à l'art. 18 de l'Instruction (Propriétés rurales), à l'article 74 (Propriétés urbaines).</p>
                                <p>(3) Se conformer aux prescriptions de l'art. 51 de l'Instruction (Tenants et aboutissants), art. 52 (Riverains), art. 53 (Propriété riveraine déjà bornée par le Service Foncier), art. 54 (Propriété riveraine appartenant au Domaine de l'Etat, aux Collectivités, etc), art. 55 (Cimetières, etc...). Les dépendances du domaine public sont désignées avec précision, avec s'il y a lieu, les noms des propriétaires au delà de ces dépendances (art. 45 de l'Instruction). Les titulaires de droits réels constituant démembrement de la propriété riveraine, sont également désignés concurremment avec le propriétaire du fond.</p>
                                <p>(4) Le numéro de chaque borne plantée ou marquée est porté une seule fois ; il est suivi, lorsqu'il y a lieu, du numéro, entre parenthèses, de la borne commune de la prorpriété riveraine avec le numéro de la Réq. ou du Titre lorsqu'il s'agit d'une propriété en instance d'immatriculation ou immatriculée (B. Réq. n° ............ ou B. Titre ...................) - l'indication D.P. s'il s'agit du domaine public (D.P. n° ...................) D. pour le domaine privé non forestier (D. n°...................), F pour les forêts (F. n° ...................), C. pour les terrains collectifs (C. n°...................). La description de la nature, de la forme, des dimensions et de la situation exacte des bornes plantées ainsi que l'emplacement précis des bornes marquées sont donnés dans la 3ème colonne. Si toutes les bornes sont de la même nature, forme et dimension, une seule description peut être faite à la borne n° 1 ou à la fin du procès-verbal.</p>
                                <p>L'emplacement de la borne est écrit lorsqu'il est déterminé par un repère fixe notoire (naturel ou artificiel).</p>
                                <p>(5) Voir au sujet de la description des bornes, le dernier alinéa du renvoi (4) ci-dessus.</p>
                            </div>
                        </div>
                    </div>

                    {/* PAGE 3 (DROITE) */}
                    <div className="sheet-side">
                        <div className="sheet-side-content">
                            <div className="mb-4">
                                <h3 className="text-center font-bold text-[13px] uppercase">Déclarations et mentions diverses</h3>
                                <p className="text-center text-[9px] italic mb-2">(Réserves au sujet du domaine public, oppositions réciproques, remplacement de bornes, etc...)</p>
                                <DottedTextArea value={pvData.declarationsMentions} onChange={(v:any)=>setPvData({...pvData, declarationsMentions:v})} lines={8} lineHeight="2.1em" isExporting={isExporting} />
                            </div>

                            <div className="mb-4">
                                <h3 className="text-center font-bold text-[13px] uppercase bg-gray-100 py-1">Contenances approximatives</h3>
                                <p className="text-center text-[9px] italic mb-2">(par parcelles, revendications, enclaves)</p>
                                <div className="py-4 text-center">
                                     <DottedTextArea 
                                        value={`${formatArea(results?.area || 0, settings.areaUnit, settings.precision)} (environ)`} 
                                        onChange={()=>{}} 
                                        lines={4} 
                                        lineHeight="2.1em" 
                                        className="text-center font-bold text-lg" 
                                        isExporting={isExporting} 
                                     />
                                </div>
                            </div>

                            <div className="mb-4">
                                <h3 className="text-center font-bold text-[13px] uppercase underline mb-2">Enonciation sommaire de la nature et de la consistance de l'Immeuble (1)</h3>
                                <DottedTextArea 
                                    value={pvData.natureConsistance1} 
                                    onChange={(v:any)=>setPvData({...pvData, natureConsistance1:v})} 
                                    lines={6} 
                                    lineHeight="2.1em" 
                                    isExporting={isExporting} 
                                    className="text-center"
                                />
                            </div>

                            <div className="mb-4">
                                <h3 className="text-center font-bold text-[13px] uppercase underline mb-2">Inventaire des pièces et des documents annexés (2)</h3>
                                <div className="space-y-1 text-[11px] leading-relaxed pl-4">
                                    <div className="flex"><span className="w-16 shrink-0 font-bold">ANNEXE</span><span>I. - Croquis de bornage S.T. 180 G</span></div>
                                    <div className="flex">
                                        <span className="w-16 shrink-0"></span>
                                        {isRepresentant ? (
                                            <span>II. - Copie de procuration</span>
                                        ) : (
                                            <span className="flex-grow flex">II. - <DottedInput value="" onChange={()=>{}} isExporting={isExporting} /></span>
                                        )}
                                    </div>
                                    <div className="flex"><span className="w-16 shrink-0"></span><span className="flex-grow flex">III. - <DottedInput value="" onChange={()=>{}} isExporting={isExporting} /></span></div>
                                    <div className="flex"><span className="w-16 shrink-0"></span><span className="flex-grow flex">IV. - <DottedInput value="" onChange={()=>{}} isExporting={isExporting} /></span></div>
                                    <div className="flex"><span className="w-16 shrink-0"></span><span className="flex-grow flex">V. - <DottedInput value="" onChange={()=>{}} isExporting={isExporting} /></span></div>
                                    <div className="flex"><span className="w-16 shrink-0"></span><span className="flex-grow flex">VI. - <DottedInput value="" onChange={()=>{}} isExporting={isExporting} /></span></div>
                                </div>
                            </div>

                            <div className="mt-4 text-justify text-[11px] leading-relaxed">
                                Et attendu que nos opérations sont terminées et qu'il ne s'est produit aucun incident, opposition ou revendication autres que ceux ci-dessus consignés, nous avons déclaré clos le présent procès-verbal qui a été signé par nous ainsi que par (3) <DottedInput value={pvData.cloturePvPar} onChange={(v:any)=>setPvData({...pvData, cloturePvPar:v})} isExporting={isExporting} />
                            </div>

                            <div className="mt-6 flex justify-between px-8 text-[11px]">
                                <div className="w-[45%] text-center">
                                    <p className="font-bold mb-8 underline">Approuvé :</p>
                                    <div className="text-left space-y-1">
                                        <div className="flex items-baseline"><DottedInput value={pvData.misEnInterligne} onChange={(v:any)=>setPvData({...pvData, misEnInterligne:v})} isExporting={isExporting} /> <span className="ml-1 whitespace-nowrap">mis en interligne.</span></div>
                                        <div className="flex items-baseline"><DottedInput value={pvData.rayesNuls} onChange={(v:any)=>setPvData({...pvData, rayesNuls:v})} isExporting={isExporting} /> <span className="ml-1 whitespace-nowrap">rayés nuls.</span></div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-auto pt-2 border-t border-black/20 text-[7px] text-justify space-y-0.5 leading-tight">
                                <p>(1) Indiquer notamment les constructions, leur nombre, les cultures existants, etc... Mentionner si elles appartiennent au propriétaire du fonds ou spécifier les noms des propriétaires pour chacune d'elles.</p>
                                <p>(2) Si l'espace ci-dessus est insuffisant, faire l'inventaire sur une feuille distincte à annexer au procès-verbal et donner ci-dessous référence à cette annexe.</p>
                                <p>(3) Requérant, interprète, etc... Indiquer, en outre, ceux qui ont déclaré ne pas savoir ou ne vouloir signer.</p>
                            </div>
                        </div>
                    </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default TechnicalPVView;