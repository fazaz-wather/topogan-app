
/**
 * Service pour le calcul de la Mappe de Repérage (Normes Cadastre)
 * Logique reverse-engineerée depuis le script Python QGIS fourni.
 * 
 * Système de grille :
 * - Niveau 1 (1/20000) : Bloc de 18 000m (X) x 12 000m (Y).
 * - Niveau 2 (1/2000)  : Division 10x10 du bloc niveau 1 (Cellule 1800m x 1200m).
 * - Niveau 3 (1/1000)  : Division 2x2 de la cellule 1/2000 (Cellule 900m x 600m).
 * - Niveau 3 (1/500)   : Division 4x4 de la cellule 1/2000 (Cellule 450m x 300m).
 */

type MappeScale = '1/20000' | '1/2000' | '1/1000' | '1/500';

export const calculateMappe = (x: number, y: number, scale: MappeScale): string => {
    if (isNaN(x) || isNaN(y)) return "";

    // Constantes de la grille (dérivées de update_extent / get_mappe_extent)
    // xmax = int(mappe[1])*18000 -> Largeur Bloc Base = 18000
    // ymax = int(mappe[0])*12000 -> Hauteur Bloc Base = 12000
    const BLOCK_W = 18000;
    const BLOCK_H = 12000;

    // Calcul des indices de base (1/20000)
    // Y commande le premier chiffre (ex: 32), X le second (ex: 7)
    // Les coordonnees Y partent de 0 et montent, mais l'indexation de mappe
    // semble correspondre à des blocs entiers depuis l'origine.
    // Index = Math.ceil(Coord / TailleBloc)
    const m1 = Math.ceil(y / BLOCK_H); // Index Y (ex: 32)
    const m2 = Math.ceil(x / BLOCK_W); // Index X (ex: 7)

    const baseMappe = `${m1}-${m2}`;

    if (scale === '1/20000') {
        return baseMappe;
    }

    // Calcul pour 1/2000
    // Dimensions d'une feuille 1/2000 : 1800m x 1200m (car 10x10 dans 18000x12000)
    const SHEET_2000_W = 1800;
    const SHEET_2000_H = 1200;

    // Coordonnées relatives à l'intérieur du bloc 1/20000
    // Le bloc commence à (m2-1)*18000 et finit à m2*18000 en X
    // Le bloc commence à (m1-1)*12000 et finit à m1*12000 en Y
    // ATTENTION : La logique Python `update_extent` soustrait la hauteur depuis le Ymax (Haut).
    // Cela implique que la numérotation des lignes va du HAUT vers le BAS pour les sous-grilles.
    
    const xBaseLeft = (m2 - 1) * BLOCK_W;
    const yBaseTop = m1 * BLOCK_H;

    const dx = x - xBaseLeft; // Distance depuis la gauche
    const dy = yBaseTop - y;  // Distance depuis le haut (Ymax)

    if (dx < 0 || dy < 0 || dx > BLOCK_W || dy > BLOCK_H) {
        return "Hors zone (Négatif)";
    }

    // Grille 10x10
    // Col (1 à 10)
    const col2000 = Math.ceil(dx / SHEET_2000_W);
    // Row (1 à 10) - Du haut vers le bas
    const row2000 = Math.ceil(dy / SHEET_2000_H);

    // Formule indexation 1 à 100
    // Ligne 1: 1-10, Ligne 2: 11-20, etc.
    const index2000 = (row2000 - 1) * 10 + col2000;

    const mappe2000 = `${baseMappe}-${index2000}`;

    if (scale === '1/2000') {
        return mappe2000;
    }

    // Coordonnées relatives à l'intérieur de la feuille 1/2000
    const xSheetLeft = (col2000 - 1) * SHEET_2000_W;
    const ySheetTop = (row2000 - 1) * SHEET_2000_H;
    
    const dx_sub = dx - xSheetLeft; // Distance X dans la feuille 1/2000
    const dy_sub = dy - ySheetTop;  // Distance Y depuis le haut de la feuille 1/2000

    // Calcul pour 1/1000 (A, B, C, D)
    if (scale === '1/1000') {
        // Grille 2x2. Largeur 900, Hauteur 600.
        // A(1,1), B(2,1)
        // C(1,2), D(2,2)
        const col1000 = Math.ceil(dx_sub / 900);
        const row1000 = Math.ceil(dy_sub / 600);

        let letter = '?';
        if (row1000 === 1 && col1000 === 1) letter = 'A';
        else if (row1000 === 1 && col1000 === 2) letter = 'B';
        else if (row1000 === 2 && col1000 === 1) letter = 'C';
        else if (row1000 === 2 && col1000 === 2) letter = 'D';

        return `${mappe2000}-${letter}`;
    }

    // Calcul pour 1/500 (a-p)
    if (scale === '1/500') {
        // Grille 4x4. Largeur 450, Hauteur 300.
        // a b c d
        // e f g h
        // i j k l
        // m n o p
        const col500 = Math.ceil(dx_sub / 450);
        const row500 = Math.ceil(dy_sub / 300);

        const letters = "abcdefghijklmnop";
        const index500 = (row500 - 1) * 4 + (col500 - 1);
        
        const letter = letters[index500] || '?';

        return `${mappe2000}-${letter}`;
    }

    return mappe2000;
};

// Fonction de simulation retirée
export const getSimulationMappe = (x: number, y: number, scale: string): string | null => {
    return null; 
}
