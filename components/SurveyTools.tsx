import React, { useState, FormEvent, ReactNode } from 'react';
import { Point } from '../types';
import { 
    calculateCoordinatesFromRadiation, 
    calculateAlignmentPoints,
    calculateAngleBetweenPoints,
    convertDecimalDegreesToDMS
} from '../services/topographyService';

type Tool = 'ANGLE' | 'RADIATION' | 'TRAVERSE' | 'ALIGNMENT';

// --- Reusable UI Components ---

interface ToolButtonProps {
  label: string;
  onClick: () => void;
  isActive: boolean;
  disabled?: boolean;
  icon: ReactNode;
}

const ToolButton: React.FC<ToolButtonProps> = ({ label, onClick, isActive, disabled, icon }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`w-full flex flex-col items-center justify-center p-3 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all duration-200
      ${isActive ? 'bg-[#4F46E5] text-white shadow-md shadow-[#4F46E5]/20' : 'bg-[#F1F5F9] dark:bg-[#1E293B] text-[#64748B] dark:text-[#94A3B8] hover:bg-[#E2E8F0] dark:hover:bg-[#334155]'}
      ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
    `}
  >
    <div className="mb-1.5">{icon}</div>
    <span className="text-center">{label}</span>
  </button>
);

const FormInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
    <input {...props} className={`bsport-input ${props.className || ''}`} />
);

const FormSelect: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = (props) => (
    <select {...props} className={`bsport-select ${props.className || ''}`}>
        {props.children}
    </select>
);

const FormButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = (props) => (
    <button {...props} className={`bsport-btn-primary w-full ${props.className || ''}`}>
        {props.children}
    </button>
);

// --- Calculator Components ---

interface CalculatorProps {
  points: Point[];
  onAddPoints: (points: { x: number; y: number }[]) => void;
}

const AngleCalculator: React.FC<{ points: Point[] }> = ({ points }) => {
    const [pA, setPA] = useState('');
    const [pB, setPB] = useState('');
    const [pC, setPC] = useState('');
    const [angleResult, setAngleResult] = useState<string | null>(null);

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        const pointA = points.find(p => p.id === parseInt(pA));
        const pointB = points.find(p => p.id === parseInt(pB));
        const pointC = points.find(p => p.id === parseInt(pC));

        if (!pointA || !pointB || !pointC) {
            alert("Veuillez sélectionner 3 sommets."); return;
        }
        if (pointA.id === pointB.id || pointB.id === pointC.id || pointA.id === pointC.id) {
            alert("Veuillez sélectionner 3 sommets différents."); return;
        }

        const angle = calculateAngleBetweenPoints(pointA, pointB, pointC);
        setAngleResult(convertDecimalDegreesToDMS(angle));
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            <FormSelect value={pA} onChange={e => setPA(e.target.value)} required>
                <option value="" disabled>Choisir Sommet A...</option>
                {points.map((p, i) => <option key={p.id} value={p.id}>Sommet B{i + 1} (ID: {p.id})</option>)}
            </FormSelect>
            <FormSelect value={pB} onChange={e => setPB(e.target.value)} required>
                <option value="" disabled>Choisir Sommet B...</option>
                {points.map((p, i) => <option key={p.id} value={p.id}>Sommet B{i + 1} (ID: {p.id})</option>)}
            </FormSelect>
            <FormSelect value={pC} onChange={e => setPC(e.target.value)} required>
                <option value="" disabled>Choisir Sommet C...</option>
                {points.map((p, i) => <option key={p.id} value={p.id}>Sommet B{i + 1} (ID: {p.id})</option>)}
            </FormSelect>
            <FormButton type="submit" disabled={points.length < 3}>Calculer l'Angle</FormButton>
            {angleResult && (
                <div className="mt-3 text-center p-2 bg-blue-100 dark:bg-blue-900/50 rounded-md">
                    <p className="font-mono font-bold text-blue-800 dark:text-blue-200">Angle ABC: {angleResult}</p>
                </div>
            )}
        </form>
    );
};

const RadiationCalculator: React.FC<CalculatorProps> = ({ points, onAddPoints }) => {
    const [stationId, setStationId] = useState('');
    const [azimuth, setAzimuth] = useState('');
    const [distance, setDistance] = useState('');

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        const station = points.find(p => p.id === parseInt(stationId));
        const az = parseFloat(azimuth);
        const dist = parseFloat(distance);

        if (!station || isNaN(az) || isNaN(dist)) {
            alert('Veuillez vérifier vos entrées. Station, azimut et distance sont requis.'); return;
        }
        
        onAddPoints([calculateCoordinatesFromRadiation(station, az, dist)]);
        setAzimuth('');
        setDistance('');
    };
    
    return (
        <form onSubmit={handleSubmit} className="space-y-3">
             <FormSelect value={stationId} onChange={e => setStationId(e.target.value)} required>
                <option value="" disabled>Choisir une station...</option>
                {points.map((p, i) => <option key={p.id} value={p.id}>Sommet B{i + 1} (ID: {p.id})</option>)}
             </FormSelect>
             <div className="flex space-x-2">
                <FormInput type="number" step="any" value={azimuth} onChange={e => setAzimuth(e.target.value)} placeholder="Azimut (deg)" required />
                <FormInput type="number" step="any" value={distance} onChange={e => setDistance(e.target.value)} placeholder="Distance" required />
             </div>
             <FormButton type="submit" disabled={points.length === 0}>Ajouter Sommet Rayonné</FormButton>
        </form>
    );
};

const TraverseCalculator: React.FC<CalculatorProps> = ({ points, onAddPoints }) => {
    const [startPointId, setStartPointId] = useState<string>('');
    const [legs, setLegs] = useState<{ azimuth: string, distance: string }[]>([{ azimuth: '', distance: '' }]);

    const handleLegChange = (index: number, field: 'azimuth' | 'distance', value: string) => {
        const newLegs = [...legs];
        newLegs[index][field] = value;
        setLegs(newLegs);
    };

    const addLeg = () => setLegs([...legs, { azimuth: '', distance: '' }]);
    const removeLeg = (index: number) => setLegs(legs.filter((_, i) => i !== index));

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        const startPoint = points.find(p => p.id === parseInt(startPointId));
        if (!startPoint) { alert("Veuillez sélectionner un sommet de départ."); return; }

        const newPoints: { x: number; y: number }[] = [];
        let currentPoint: Point = { ...startPoint };

        for (const leg of legs) {
            const azimuth = parseFloat(leg.azimuth);
            const distance = parseFloat(leg.distance);

            if (isNaN(azimuth) || isNaN(distance)) {
                alert("Veuillez vérifier que toutes les visées ont un azimut et une distance valides."); return;
            }

            const newPoint = calculateCoordinatesFromRadiation(currentPoint, azimuth, distance);
            newPoints.push(newPoint);
            currentPoint = { ...newPoint, id: -1 };
        }

        if (newPoints.length > 0) onAddPoints(newPoints);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            <FormSelect value={startPointId} onChange={e => setStartPointId(e.target.value)} required>
                <option value="" disabled>Choisir sommet de départ...</option>
                {points.map((p, i) => <option key={p.id} value={p.id}>Sommet B{i + 1} (ID: {p.id})</option>)}
            </FormSelect>
            {legs.map((leg, index) => (
                <div key={index} className="flex items-center space-x-2">
                    <div className="flex-1 grid grid-cols-2 gap-2">
                        <FormInput type="number" step="any" value={leg.azimuth} onChange={e => handleLegChange(index, 'azimuth', e.target.value)} placeholder={`Azimut ${index + 1}`} required />
                        <FormInput type="number" step="any" value={leg.distance} onChange={e => handleLegChange(index, 'distance', e.target.value)} placeholder={`Distance ${index + 1}`} required />
                    </div>
                    <button type="button" onClick={() => removeLeg(index)} className="p-1 text-red-500 hover:text-red-700">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg>
                    </button>
                </div>
            ))}
            <button type="button" onClick={addLeg} className="w-full text-xs text-blue-600 hover:text-blue-800 font-semibold py-1">+ Ajouter une visée</button>
            <FormButton type="submit" disabled={points.length === 0}>Calculer et Ajouter les Sommets</FormButton>
        </form>
    );
};

const AlignmentCalculator: React.FC<CalculatorProps> = ({ points, onAddPoints }) => {
    const [startPointId, setStartPointId] = useState('');
    const [endPointId, setEndPointId] = useState('');
    const [numPoints, setNumPoints] = useState('1');

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        const startPoint = points.find(p => p.id === parseInt(startPointId));
        const endPoint = points.find(p => p.id === parseInt(endPointId));
        const num = parseInt(numPoints);

        if (!startPoint || !endPoint || isNaN(num) || num < 1) { alert("Veuillez sélectionner deux sommets et un nombre valide."); return; }
        if (startPoint.id === endPoint.id) { alert("Les sommets de départ et d'arrivée doivent être différents."); return; }

        onAddPoints(calculateAlignmentPoints(startPoint, endPoint, num));
    };
    
    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            <FormSelect value={startPointId} onChange={e => setStartPointId(e.target.value)} required>
                <option value="" disabled>Sommet de départ...</option>
                {points.map((p, i) => <option key={p.id} value={p.id}>Sommet B{i + 1} (ID: {p.id})</option>)}
            </FormSelect>
            <FormSelect value={endPointId} onChange={e => setEndPointId(e.target.value)} required>
                <option value="" disabled>Sommet d'arrivée...</option>
                {points.map((p, i) => <option key={p.id} value={p.id}>Sommet B{i + 1} (ID: {p.id})</option>)}
            </FormSelect>
            <FormInput type="number" min="1" step="1" value={numPoints} onChange={e => setNumPoints(e.target.value)} placeholder="Nb de points intermédiaires" required />
            <FormButton type="submit" disabled={points.length < 2}>Créer Sommets d'Alignement</FormButton>
        </form>
    );
};

// --- Main SurveyTools Component ---
interface SurveyToolsProps {
  points: Point[];
  onAddPoints: (points: { x: number; y: number }[]) => void;
}
const SurveyTools: React.FC<SurveyToolsProps> = ({ points, onAddPoints }) => {
  const [activeTool, setActiveTool] = useState<Tool | null>(null);

  const handleToolSelect = (tool: Tool) => {
    setActiveTool(prev => (prev === tool ? null : tool));
  };

  const toolComponents: Record<Tool, ReactNode> = {
      'ANGLE': <AngleCalculator points={points} />,
      'RADIATION': <RadiationCalculator points={points} onAddPoints={onAddPoints} />,
      'TRAVERSE': <TraverseCalculator points={points} onAddPoints={onAddPoints} />,
      'ALIGNMENT': <AlignmentCalculator points={points} onAddPoints={onAddPoints} />,
  };
  
  return (
    <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
            <ToolButton label="Observations d'angles" onClick={() => handleToolSelect('ANGLE')} isActive={activeTool === 'ANGLE'} disabled={points.length < 3} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>} />
            <ToolButton label="Rayonnement" onClick={() => handleToolSelect('RADIATION')} isActive={activeTool === 'RADIATION'} disabled={points.length < 1} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>} />
            <ToolButton label="Cheminement" onClick={() => handleToolSelect('TRAVERSE')} isActive={activeTool === 'TRAVERSE'} disabled={points.length < 1} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>} />
            <ToolButton label="Alignement" onClick={() => handleToolSelect('ALIGNMENT')} isActive={activeTool === 'ALIGNMENT'} disabled={points.length < 2} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>} />
        </div>
        {activeTool && (
            <div className="p-3 bg-gray-100 dark:bg-gray-800/50 rounded-md border border-gray-200 dark:border-gray-700">
                {toolComponents[activeTool]}
            </div>
        )}
    </div>
  );
};

export default SurveyTools;