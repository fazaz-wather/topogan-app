import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Parcel, AppSettings, CalculationResults } from '../types';
import { formatArea } from '../services/unitConversionService';

interface TechnicalPVViewProps {
    parcel?: Parcel;
    settings: AppSettings;
    results: CalculationResults | null;
    onClose: () => void;
}

const TechnicalPVView: React.FC<TechnicalPVViewProps> = ({ parcel, settings, results, onClose }) => {
    const [zoom, setZoom] = useState(0.55);
    const [isExporting, setIsExporting] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    
    const [pvData, setPvData] = useState({
        conservation: '',
        requisitionNo: '',
        piecesAnnexes: '',
        references4: '',
        dateAn: '........................', 
        dateMoisJour: '............................................', 
        heureText: '......................', 
        minuteText: '......................', 
        proprietaireNom: '',
        proprietaireDemeurant: '',
        vu: '',
        presentsMM3: '',
        departBornage2: 'la borne n° 1',
        suiteOperations: '',
        incidentsRecap: 'Néant.',
        droitsReelsRecap: 'Néant.',
        declarationsMentions: '',
        natureConsistance1: '',
        inventairePieces2: 'I.- Croquis de bornage S.T. 180 G\nII.- Tableau des coordonnées\nIII.- ',
        rayesNuls: '........',
        misEnInterligne: '........'
    });

    // Helper pour convertir un nombre en texte français (pour les dates)
    const numberToFrench = (num: number): string => {
        const units = ["", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf"];
        const teens = ["dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];
        const tens = ["", "dix", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante-dix", "quatre-vingt", "quatre-vingt-dix"];

        if (num === 0) return ""; 
        if (num < 10) return units[num];
        if (num < 20) return teens[num - 10];
        
        const tenDigit = Math.floor(num / 10);
        const unitDigit = num % 10;

        // Cas spéciaux 70-79 et 90-99
        if (tenDigit === 7) {
            return `soixante-${unitDigit === 1 ? 'et-onze' : (teens[unitDigit] || 'dix')}`;
        }
        if (tenDigit === 9) {
            return `quatre-vingt-${teens[unitDigit] || 'dix'}`;
        }
        
        let str = tens[tenDigit];
        if (tenDigit === 8) str += "s"; // quatre-vingts
        
        if (unitDigit === 1 && tenDigit !== 8) str += " et un";
        else if (unitDigit > 0) {
             if (tenDigit === 8) str = "quatre-vingt"; // Retire le 's' s'il y a une unité derrière
             str += `-${units[unitDigit]}`;
        }
        return str;
    };

    useEffect(() => {
        if (parcel) {
            const situationParts = parcel.situation?.split(',') || [];
            
            let anneeTxt = '........................';
            let moisJourTxt = '............................................';

            // Conversion de la date
            if (parcel.date) {
                const d = new Date(parcel.date);
                if (!isNaN(d.getTime())) {
                    const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
                    const day = d.getDate();
                    const month = months[d.getMonth()];
                    const year = d.getFullYear();
                    
                    const dayTxt = day === 1 ? 'premier' : numberToFrench(day);
                    moisJourTxt = `${dayTxt} ${month}`;
                    
                    const yearRest = year % 100; // ex: 2024 -> 24
                    // On suppose qu'on est dans les années 2000 (L'an deux mille...)
                    anneeTxt = numberToFrench(yearRest);
                }
            }

            setPvData(prev => ({
                ...prev,
                conservation: situationParts[0]?.trim() || '',
                requisitionNo: parcel.requisition || '',
                natureConsistance1: `${parcel.nature || ''} - ${parcel.consistance || ''}`.trim() || 'Terrain Nu (T.N)',
                proprietaireNom: parcel.propriete || '',
                proprietaireDemeurant: parcel.situation || '',
                dateAn: anneeTxt !== '........................' ? anneeTxt : prev.dateAn,
                dateMoisJour: moisJourTxt !== '............................................' ? moisJourTxt : prev.dateMoisJour
            }));
        }
    }, [parcel]);

    if (!parcel) return null;

    const handlePrint = () => window.print();

    const handleExportPdf = async () => {
        if (isExporting) return;
        setIsExporting(true);
        
        try {
            const sheets = containerRef.current?.querySelectorAll('.a3-sheet');
            if (!sheets) return;

            // Sauvegarder les styles de transformation pour les restaurer après
            const originalStyles: { transform: string; margin: string }[] = [];
            
            // Réinitialiser la transformation pour une capture haute qualité sans zoom
            sheets.forEach((sheet) => {
                const el = sheet as HTMLElement;
                originalStyles.push({
                    transform: el.style.transform,
                    margin: el.style.margin
                });
                el.style.transform = 'none';
                el.style.margin = '0';
            });

            // Délai pour laisser React faire le rendu des "span" au lieu des "input" (à cause de isExporting)
            await new Promise(resolve => setTimeout(resolve, 200));

            const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
            
            for (let i = 0; i < sheets.length; i++) {
                const sheet = sheets[i] as HTMLElement;
                
                // Utiliser html2canvas avec une échelle plus élevée pour une meilleure qualité
                const canvas = await html2canvas(sheet, { 
                    scale: 2, 
                    useCORS: true, 
                    backgroundColor: '#ffffff',
                    logging: false,
                    // Force la capture des valeurs de formulaires (redondant avec notre fix manuel mais utile)
                    onclone: (clonedDoc) => {
                        const inputs = clonedDoc.querySelectorAll('input');
                        inputs.forEach((input: any) => {
                            input.setAttribute('value', input.value);
                        });
                        const textareas = clonedDoc.querySelectorAll('textarea');
                        textareas.forEach((area: any) => {
                            area.innerHTML = area.value;
                        });
                    }
                });
                
                if (i > 0) pdf.addPage('a3', 'landscape');
                
                // Ajouter l'image au PDF (qualité JPEG 0.95)
                pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 420, 297);
            }
            
            // Restaurer les styles originaux
            sheets.forEach((sheet, i) => {
                const el = sheet as HTMLElement;
                el.style.transform = originalStyles[i].transform;
                el.style.margin = originalStyles[i].margin;
            });

            pdf.save(`PV_Bornage_${parcel.name.replace(/\s+/g, '_')}.pdf`);
        } catch (error) {
            console.error("Erreur export PDF:", error);
            alert("Une erreur est survenue lors de la génération du PDF.");
        } finally { 
            setIsExporting(false); 
        }
    };

    const DottedInput = ({ value, onChange, width = "flex-grow", center = true, style = {} }: any) => (
        <div className={`border-b border-dotted border-gray-400 px-1 mx-0.5 ${width} inline-block relative top-0.5`}>
            {isExporting ? (
                // En mode export, on affiche un span statique pour garantir le rendu html2canvas
                <span 
                    className={`w-full block bg-transparent border-none p-0 text-black font-bold text-[12px] ${center ? 'text-center' : 'text-left'} leading-none font-serif`}
                    style={{...style, minHeight: '14px'}}
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

    const DottedTextArea = ({ value, onChange, lines = 5, className = "", lineHeight = "1.8em" }: any) => (
        <div className={`relative w-full ${className}`}>
            <div className="absolute inset-0 pointer-events-none">
                {Array.from({ length: lines }).map((_, i) => (
                    <div key={i} className="border-b border-dotted border-gray-400" style={{ height: lineHeight }}></div>
                ))}
            </div>
            {isExporting ? (
                // En mode export, on utilise un div pour préserver les sauts de ligne
                <div 
                    className="relative w-full bg-transparent border-none p-0 text-black font-bold text-[12px] overflow-hidden font-serif whitespace-pre-wrap"
                    style={{ lineHeight: lineHeight, minHeight: `calc(${lines} * ${lineHeight})` }}
                >
                    {value}
                </div>
            ) : (
                <textarea 
                    value={value} 
                    onChange={(e) => onChange(e.target.value)}
                    rows={lines}
                    className="relative w-full bg-transparent border-none p-0 focus:ring-0 text-black font-bold text-[12px] resize-none overflow-hidden font-serif"
                    style={{ lineHeight: lineHeight }}
                    spellCheck={false}
                />
            )}
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-gray-600 overflow-hidden select-text">
            <div className="flex items-center justify-between p-4 bg-white/95 border-b border-gray-300 z-50 no-print shadow-md">
                <div className="flex items-center gap-6">
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                    </button>
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Zoom PV</span>
                        <input type="range" min="0.3" max="1.1" step="0.05" value={zoom} onChange={(e) => setZoom(parseFloat(e.target.value))} className="w-32 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
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
                
                /* Layout Split Page 1 */
                .page1-split { display: flex; height: 100%; }
                .page1-left-col { width: 22%; border-right: none; padding: 8mm 4mm; display: flex; flex-direction: column; align-items: center; }
                .page1-right-col { width: 78%; padding: 8mm 6mm; display: flex; flex-direction: column; position: relative; }
                
                .dashed-line-fill { border-bottom: 1px dotted #999; flex-grow: 1; margin: 0 4px; position: relative; top: -4px; }
            `}</style>

            <div ref={containerRef} className="flex-1 overflow-auto p-12 flex flex-col items-center gap-16 no-scrollbar">
                
                {/* FEUILLET 1 : RECTO (PAGE 4 | PAGE 1) */}
                <div 
                    className="a3-sheet bg-white shadow-2xl flex flex-row pv-font shrink-0 transition-transform origin-top"
                    style={{ width: '420mm', height: '297mm', transform: `scale(${zoom})` }}
                >
                    {/* PAGE 4 (GAUCHE) */}
                    <div className="sheet-side">
                        <div className="sheet-side-content">
                            <div className="flex-1">
                                <h3 className="text-center font-bold text-[13px] uppercase underline mb-1">Incidents, Oppositions ou Revendications (1)</h3>
                                <p className="text-center text-[9px] italic mb-3">(Récapitulation)</p>
                                <DottedTextArea value={pvData.incidentsRecap} onChange={(v:any)=>setPvData({...pvData, incidentsRecap:v})} lines={22} lineHeight="2.1em" />
                            </div>
                            <div className="flex-1 mt-6">
                                <h3 className="text-center font-bold text-[13px] uppercase underline mb-1">Droits réels (Servitudes, Charges foncières (2), etc...)</h3>
                                <p className="text-center text-[9px] italic mb-3">(Récapitulation)</p>
                                <DottedTextArea value={pvData.droitsReelsRecap} onChange={(v:any)=>setPvData({...pvData, droitsReelsRecap:v})} lines={14} lineHeight="2.1em" />
                            </div>
                            <div className="mt-auto pt-3 border-t border-black/20">
                                <p className="footnote">(1) Récapituler sommairement et au bureau le cas échéant, tous les incidents, oppositions, revendications ou interventions en renvoyant aux mentions portées dans le corps du procès-verbal, aux annexes signées des intéressés et à la description des revendications bornées.</p>
                                <p className="footnote">(2) Mitoyennetés, droits de passage, de vues, d'eau, égouts des toits, etc...</p>
                            </div>
                        </div>
                    </div>

                    {/* PAGE 1 (DROITE) - STRUCTURE DIVISÉE */}
                    <div className="sheet-side">
                        <div className="page1-split">
                            {/* COLONNE GAUCHE (Administrative) */}
                            <div className="page1-left-col text-center">
                                <div className="space-y-1 mb-6 w-full">
                                    <p className="font-bold uppercase text-[10px]">Royaume du Maroc</p>
                                    <div className="h-[1.5px] w-8 bg-black mx-auto my-2"></div>
                                    <p className="font-bold text-[8px] leading-tight">Agence Nationale de la Conservation Foncière<br/>du Cadastre et de la Cartographie</p>
                                    <p className="font-bold text-[9px] mt-3">Conservation Foncière</p>
                                    <div className="flex items-center justify-center text-[10px] mt-1">d<DottedInput value={pvData.conservation} onChange={(v:any)=>setPvData({...pvData, conservation:v})} width="w-24" /></div>
                                    <div className="h-[1.5px] w-8 bg-black mx-auto mt-3"></div>
                                </div>

                                <div className="w-full text-left space-y-2 mb-6">
                                    <p className="font-bold text-[10px]">Réquisition d'Immatriculation</p>
                                    <div className="flex items-center font-bold text-[11px]">N° <DottedInput value={pvData.requisitionNo} onChange={(v:any)=>setPvData({...pvData, requisitionNo:v})} /></div>
                                    <div className="h-[1.5px] w-8 bg-black mx-auto my-3"></div>
                                </div>

                                <div className="w-full text-left space-y-2 flex-grow">
                                    <div className="flex items-start text-[10px] mb-1">
                                        <span className="shrink-0 mr-1 font-bold underline">Pièces annexées</span>
                                    </div>
                                    <div className="flex items-start text-[10px]">
                                        <span className="shrink-0 mr-1">Références (4)</span>
                                        <DottedInput value={pvData.references4} onChange={(v:any)=>setPvData({...pvData, references4:v})} />
                                    </div>
                                    <DottedTextArea value="" onChange={()=>{}} lines={8} lineHeight="1.7em" />
                                </div>

                                <div className="w-full text-justify text-[7px] space-y-1 mt-3 pt-2 border-t border-black/20 leading-tight">
                                    <p>(1) Prendre renseignements exacts près des autorités locales et personnes présentes. Etablir la situation de l'immeuble en se conformant aux prescriptions de l'art. 21 de l'instruction sur les bornages.</p>
                                    <p>(2) Voir alinéa 1er de l'art. 22 de l'instruction...</p>
                                    <p>(3) Noms, prénoms, qualités et domiciles de toutes les personnes intéressées par le bornage et de tous les assistants à inscrire successivement au moment où ils se présentent. Se conformer aux art. 22, 23, 24, 25 de l'instruction précitée, spécialement en ce qui concerne les qualités des personnes et leur représentation.</p>
                                    <p>(4) Rappel des procès-verbaux complémentaires établis dans la suite.</p>
                                    <p className="font-bold mt-1">NOTA.</p>
                                    <p>Si l'espace réservé ci-contre est insuffisant pour l'inscription de toutes les personnes intéressées, la liste en est continuée sur une feuille blanche, du format du procès-verbal, annexée à celui-ci.</p>
                                </div>
                            </div>

                            {/* COLONNE DROITE (Corps du PV) */}
                            <div className="page1-right-col">
                                <div className="absolute top-4 right-4 text-[9pt] font-bold">I. F. 84 A</div>
                                
                                <div className="official-title mt-28">
                                    <h1>PROCES -VERBAL DE BORNAGE</h1>
                                </div>

                                <div className="text-[13px] font-bold mb-5 flex items-baseline">
                                    <span className="shrink-0 mr-3">de la propriété dite :</span>
                                    <DottedInput value={pvData.proprietaireNom} onChange={(v:any)=>setPvData({...pvData, proprietaireNom:v})} />
                                </div>

                                <div className="space-y-3 text-[12px] pl-4">
                                    <div className="flex items-start relative ml-8">
                                        <div className="situation-brace-label">
                                            <div>Située</div>
                                            <div>à (1)</div>
                                        </div>
                                        <div className="situation-container flex-grow w-full">
                                            <div className="flex items-center flex-nowrap"><span className="w-36 shrink-0 text-[11px] whitespace-nowrap">Province ou Préfecture :</span><DottedInput value={parcel.situation?.split(',')[0]} onChange={()=>{}} /></div>
                                            <div className="flex items-center flex-nowrap"><span className="w-36 shrink-0 text-[11px] whitespace-nowrap">Cercle, commune, ville :</span><DottedInput value={parcel.situation?.split(',')[1]} onChange={()=>{}} /></div>
                                            <div className="flex items-center flex-nowrap"><span className="w-36 shrink-0 text-[11px] whitespace-nowrap">Lieu-dit ou rue :</span><DottedInput value={parcel.situation?.split(',')[2]} onChange={()=>{}} /></div>
                                        </div>
                                    </div>

                                    <div className="mt-6 leading-[2.4] text-[13px]">
                                        <div className="flex items-baseline flex-nowrap">
                                            <span className="whitespace-nowrap mr-2">L'an deux mille :</span>
                                            <DottedInput value={pvData.dateAn} onChange={(v:any)=>setPvData({...pvData, dateAn:v})} width="w-40" />
                                            <span className="whitespace-nowrap mx-2">, le</span>
                                            <DottedInput value={pvData.dateMoisJour} onChange={(v:any)=>setPvData({...pvData, dateMoisJour:v})} width="flex-grow" />
                                        </div>
                                        
                                        <div className="flex items-baseline flex-nowrap">
                                            <span className="whitespace-nowrap mr-2">à</span>
                                            <DottedInput value={pvData.heureText} onChange={(v:any)=>setPvData({...pvData, heureText:v})} width="w-32" />
                                            <span className="whitespace-nowrap mx-2">heures</span>
                                            <DottedInput value={pvData.minuteText} onChange={(v:any)=>setPvData({...pvData, minuteText:v})} width="w-32" />
                                            <span className="whitespace-nowrap mx-2">minutes</span>
                                            <span className="whitespace-nowrap text-[11px] ml-2">(en toutes lettres)</span>
                                        </div>
                                        
                                        <div className="mt-3 flex items-baseline flex-nowrap">
                                            <span className="font-bold mr-2 whitespace-nowrap">Nous soussigné,</span>
                                            <DottedInput value={parcel.surveyor} onChange={()=>{}} />
                                        </div>
                                        <DottedTextArea value="" onChange={()=>{}} lines={2} lineHeight="2.4em" />
                                        
                                        <div className="mt-1 flex items-baseline flex-nowrap">
                                            <span className="mr-2 whitespace-nowrap">En vue de procéder au bornage de la propriété dite</span>
                                            <DottedInput value={parcel.propriete || parcel.name} onChange={()=>{}} />
                                        </div>
                                        
                                        <div className="flex items-baseline mt-1 flex-nowrap">
                                            <span className="mr-2 whitespace-nowrap">dont l'immatriculation a été requise sous le n°</span>
                                            <DottedInput value={pvData.requisitionNo} onChange={(v:any)=>setPvData({...pvData, requisitionNo:v})} width="w-24" />
                                            <span className="mx-2 whitespace-nowrap">par</span>
                                            <span className="font-bold mr-2 whitespace-nowrap">M (2)</span>
                                            <DottedInput value={pvData.proprietaireNom} onChange={(v:any)=>setPvData({...pvData, proprietaireNom:v})} />
                                        </div>

                                        <div className="flex items-baseline mt-1 flex-nowrap">
                                            <span className="mr-2 whitespace-nowrap">demeurant à</span>
                                            <DottedInput value={pvData.proprietaireDemeurant} onChange={(v:any)=>setPvData({...pvData, proprietaireDemeurant:v})} />
                                        </div>

                                        <div className="flex items-baseline mt-1 flex-nowrap">
                                            <span className="mr-2 whitespace-nowrap">Vu</span>
                                            <DottedInput value={pvData.vu} onChange={(v:any)=>setPvData({...pvData, vu:v})} />
                                        </div>
                                        <DottedTextArea value="" onChange={()=>{}} lines={1} lineHeight="2.4em" />
                                    </div>

                                    <div className="mt-4 text-justify text-[12px] leading-relaxed">
                                        Attendu que tous les intéressés ont été prévenus, ainsi qu'il est prescrit par le Dahir sur la Propriété Foncière, suivant publications et convocations régulières ;
                                        <br/>
                                        Nous nous sommes transporté sur la dite propriété et y avons trouvé :
                                    </div>

                                    <div className="mt-2 flex items-start h-full">
                                        <span className="font-bold text-[12px] uppercase mt-2 mr-3">MM. (3)</span>
                                        <DottedTextArea value={pvData.presentsMM3} onChange={(v:any)=>setPvData({...pvData, presentsMM3:v})} lines={14} lineHeight="2.1em" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* FEUILLET 2 : VERSO (PAGE 2 | PAGE 3) */}
                <div 
                    className="a3-sheet bg-white shadow-2xl flex flex-row pv-font shrink-0 transition-transform origin-top"
                    style={{ width: '420mm', height: '297mm', transform: `scale(${zoom})` }}
                >
                    {/* PAGE 2 (GAUCHE) */}
                    <div className="sheet-side">
                        <div className="sheet-side-content">
                            <h2 className="text-center font-bold text-[16px] uppercase mb-4 tracking-widest underline">RIVERAINS (3)</h2>
                            <table className="table-bordered text-[10px]">
                                <thead>
                                    <tr className="h-10">
                                        <th className="w-[35%]">RIVERAINS (3)</th>
                                        <th className="w-[12%]">Indication<br/>présence (5)</th>
                                        <th className="w-[15%]">NUMERO<br/>DES BORNES</th>
                                        <th className="w-[38%]">NATURE DES BORNES ET DES LIMITES</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {parcel.riverains && parcel.riverains.length > 0 ? (
                                        parcel.riverains.map(riv => (
                                            <tr key={riv.id} className="h-10">
                                                <td className="align-top font-bold uppercase text-[9px]">{riv.name}</td>
                                                <td className="text-center font-bold text-blue-800 align-middle">P</td>
                                                <td className="text-center font-mono font-bold align-middle">{riv.segmentLabel.replace(/ - /g, '/')}</td>
                                                <td className="align-top italic text-[9px]">{riv.consistance}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        Array.from({length: 14}).map((_, i) => (
                                            <tr key={i} className="h-8"><td></td><td></td><td></td><td></td></tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                            <div className="mt-6 space-y-4">
                                <p className="text-[12px]">Après nous être rendu compte des limites générales de l'immeuble à borner (1)</p>
                                <div className="flex items-center flex-nowrap text-[12px]">
                                    <span className="whitespace-nowrap">nous prenons comme point de départ de nos opérations (2)</span>
                                    <DottedInput value={pvData.departBornage2} onChange={(v:any)=>setPvData({...pvData, departBornage2:v})} />
                                </div>
                                <div className="flex items-start text-[12px] leading-relaxed">
                                    <span className="shrink-0 mt-2">et nous y</span>
                                    <DottedTextArea value={pvData.suiteOperations} onChange={(v:any)=>setPvData({...pvData, suiteOperations:v})} lines={6} lineHeight="2.1em" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* PAGE 3 (DROITE) */}
                    <div className="sheet-side">
                        <div className="sheet-side-content">
                            <div className="mb-6 border-[1.5pt] border-black p-4 bg-gray-50/20">
                                <h3 className="text-center font-black text-[13px] uppercase mb-4 tracking-widest underline underline-offset-8">Déclarations et mentions diverses</h3>
                                <DottedTextArea value={pvData.declarationsMentions} onChange={(v:any)=>setPvData({...pvData, declarationsMentions:v})} lines={10} lineHeight="2.1em" className="text-center" />
                            </div>
                            <div className="mb-6">
                                <h3 className="font-bold text-[13px] uppercase border-b border-black w-full pb-1 mb-4 text-center tracking-widest">Contenances</h3>
                                <div className="bg-white border-[1.5pt] border-black p-6 flex items-center justify-center shadow-sm">
                                    <div className="text-center w-full">
                                        <div className="text-[42px] font-black text-black leading-none mb-2">{formatArea(results?.area || 0, settings.areaUnit, settings.precision)}</div>
                                        <p className="text-[10px] font-bold uppercase tracking-widest border-t border-black/20 pt-2 text-gray-600">Surface Totale de la propriété</p>
                                    </div>
                                </div>
                            </div>
                            <div className="mb-4 flex-grow">
                                <h3 className="font-bold text-[13px] uppercase border-b border-black w-full pb-1 mb-4 text-center tracking-widest">Inventaire des pièces</h3>
                                <DottedTextArea value={pvData.inventairePieces2} onChange={(v:any)=>setPvData({...pvData, inventairePieces2:v})} lines={8} lineHeight="2em" />
                            </div>
                            <div className="mt-4 border-t-2 border-black pt-4">
                                <div className="flex justify-between px-8">
                                    <div className="text-center w-[40%]">
                                        <p className="underline font-black mb-16 uppercase text-[11px] tracking-widest">Approuvé :</p>
                                        <div className="flex items-center text-[10px] italic text-gray-500">
                                            <DottedInput value={pvData.rayesNuls} onChange={(v:any)=>setPvData({...pvData, rayesNuls:v})} center />
                                            <span className="ml-1 whitespace-nowrap">rayés nuls.</span>
                                        </div>
                                    </div>
                                    <div className="text-center w-[40%]">
                                        <p className="underline font-black mb-20 uppercase text-[11px] leading-tight tracking-widest">L'Ingénieur Géomètre Délégué</p>
                                        <span className="font-black italic text-[14px] block text-blue-900">{parcel.surveyor}</span>
                                    </div>
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