
import React, { useRef, useState, useEffect } from 'react';

interface PhotoCaptureModalProps {
    onCapture: (base64Image: string) => void;
    onClose: () => void;
}

const PhotoCaptureModal: React.FC<PhotoCaptureModalProps> = ({ onCapture, onClose }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    
    const [isStreamReady, setIsStreamReady] = useState(false);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        const startCamera = async () => {
            if (!isMounted) return;
            setError(null);

            // Vérification de sécurité (HTTPS ou localhost requis pour getUserMedia)
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                if (isMounted) setError("L'accès à la caméra nécessite une connexion sécurisée (HTTPS) ou n'est pas supporté.");
                return;
            }

            try {
                // Tentative avec la caméra arrière (environment)
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
                    audio: false
                });
                
                // Si le composant est démonté pendant le chargement
                if (!isMounted) {
                    stream.getTracks().forEach(track => track.stop());
                    return;
                }

                streamRef.current = stream;
                const videoEl = videoRef.current;
                
                if (videoEl) {
                    videoEl.srcObject = stream;
                    // Utilisation de onloadedmetadata pour lancer la lecture
                    videoEl.onloadedmetadata = () => {
                        if (isMounted && videoEl) {
                            setIsStreamReady(true);
                            // Capture de la promesse play() pour gérer les interruptions ou erreurs
                            videoEl.play().catch(e => {
                                console.warn("Lecture vidéo interrompue ou échouée:", e);
                            });
                        }
                    };
                }
            } catch (err: any) {
                if (!isMounted) return;
                console.warn("Erreur d'accès caméra:", err);
                
                // Gestion détaillée des erreurs
                if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                    setError("Accès à la caméra refusé. Veuillez utiliser le bouton d'importation.");
                } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                    setError("Aucune caméra détectée. Veuillez importer une image.");
                } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
                    setError("La caméra est utilisée par une autre application.");
                } else {
                    setError("Impossible d'accéder à la caméra. Essayez d'importer une image.");
                }
            }
        };

        if (!capturedImage) {
            // Attraper les erreurs non gérées de la fonction async elle-même
            startCamera().catch(e => console.error("Erreur inattendue startCamera:", e));
        }

        return () => {
            isMounted = false;
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }
        };
    }, [capturedImage]);

    const takePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            
            const context = canvas.getContext('2d');
            if (context) {
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                // Compresser l'image en JPEG qualité 0.7
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                setCapturedImage(dataUrl);
            }
        }
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                if (e.target?.result) {
                    setCapturedImage(e.target.result as string);
                    setError(null);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };

    const handleSave = () => {
        if (capturedImage) {
            onCapture(capturedImage);
            onClose();
        }
    };

    const handleRetake = () => {
        setCapturedImage(null);
        setIsStreamReady(false);
        setError(null);
    };

    return (
        <div className="fixed inset-0 bg-black z-[2100] flex flex-col items-center justify-center">
            {/* Input fichier caché */}
            <input 
                type="file" 
                ref={fileInputRef} 
                accept="image/*" 
                className="hidden" 
                onChange={handleFileUpload} 
            />

            <div className="relative w-full h-full flex flex-col">
                <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
                    {/* Affichage de l'erreur ou de la vidéo */}
                    {error && !capturedImage ? (
                        <div className="text-white text-center p-6 max-w-sm animate-fade-slide-in">
                            <div className="bg-red-500/10 p-4 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-bold mb-2">Caméra indisponible</h3>
                            <p className="mb-6 text-gray-300 text-sm">{error}</p>
                            <button 
                                onClick={triggerFileInput} 
                                className="bg-[#4F46E5] hover:bg-[#4338CA] text-white font-bold py-3 px-6 rounded-xl transition-colors w-full flex items-center justify-center gap-2 shadow-lg shadow-[#4F46E5]/20"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                </svg>
                                Importer une image
                            </button>
                        </div>
                    ) : !capturedImage ? (
                        <video 
                            ref={videoRef} 
                            className="absolute inset-0 w-full h-full object-cover" 
                            playsInline 
                            muted 
                            // autoPlay retiré pour éviter les conflits, géré manuellement
                        />
                    ) : (
                        <img src={capturedImage} alt="Captured" className="absolute inset-0 w-full h-full object-contain" />
                    )}
                    <canvas ref={canvasRef} className="hidden" />
                </div>

                {/* Barre de contrôles */}
                <div className="bg-black/80 p-6 flex justify-around items-center w-full pb-safe">
                    {!capturedImage ? (
                        <>
                            <button onClick={onClose} className="text-white p-4 text-sm font-semibold hover:text-gray-300 transition-colors">Annuler</button>
                            
                            {!error && (
                                <button 
                                    onClick={takePhoto} 
                                    disabled={!isStreamReady}
                                    className={`w-16 h-16 rounded-full border-4 border-white bg-white/20 flex items-center justify-center transition-all active:scale-95 hover:bg-white/30 ${!isStreamReady ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                >
                                    <div className="w-12 h-12 bg-white rounded-full shadow-inner"></div>
                                </button>
                            )}

                            {!error ? (
                                <button onClick={triggerFileInput} className="text-white p-4 hover:text-gray-300 transition-colors" title="Importer">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                    </svg>
                                </button>
                            ) : (
                                <div className="w-16"></div> // Spacer
                            )}
                        </>
                    ) : (
                        <>
                            <button onClick={handleRetake} className="text-white px-5 py-2.5 rounded-xl border border-gray-500 text-sm font-semibold hover:bg-gray-800 transition-colors">Reprendre</button>
                            <button onClick={handleSave} className="bg-[#4F46E5] hover:bg-[#4338CA] text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-[#4F46E5]/20 transition-colors">Enregistrer</button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PhotoCaptureModal;
