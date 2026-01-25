import { NextResponse } from 'next/server';

// --- TIPAGEM ---
type FeedbackData = {
    is_ok: boolean;
    dir: number;
    mult: number;
    degrau_valor: number;
    msg_simplificada: string;
};

// --- CONSTANTES E MAPAS ---
const FEEDBACK_MAP: Record<string, Record<string, FeedbackData>> = {
    "ASAS": {
        "Falta ao carro muita velocidade nas retas": { is_ok: false, dir: -1, mult: 2, degrau_valor: 3, msg_simplificada: 'NOK (muito alto)' },
        "O carro está perdendo alguma velocidade nas retas": { is_ok: false, dir: -1, mult: 1, degrau_valor: 2, msg_simplificada: 'NOK (alto)' },
        "O carro poderia ter um pouco mais de velocidade nas retas": { is_ok: false, dir: -1, mult: 1, degrau_valor: 1, msg_simplificada: 'NOK (pouco alto)' },
        "OK": { is_ok: true, dir: 0, mult: 0, degrau_valor: 0, msg_simplificada: 'OK' },
        "Estou perdendo um pouco de aderência nas curvas": { is_ok: false, dir: 1, mult: 1, degrau_valor: -1, msg_simplificada: 'NOK (pouco baixo)' },
        "O carro é muito instável em muitas curvas": { is_ok: false, dir: 1, mult: 1, degrau_valor: -2, msg_simplificada: 'NOK (baixo)' },
        "Não posso dirigir o carro, ele não tem aderência": { is_ok: false, dir: 1, mult: 2, degrau_valor: -3, msg_simplificada: 'NOK (muito baixo)' },
    },
    "MOTOR": {
        "Não, não, não!!! Favoreça muito mais as baixas rotações!": { is_ok: false, dir: -1, mult: 2, degrau_valor: 3, msg_simplificada: 'NOK (muito alto)' },
        "As rotações estão muito altas": { is_ok: false, dir: -1, mult: 1, degrau_valor: 2, msg_simplificada: 'NOK (alto)' },
        "Tente favorecer um pouco mais as baixas rotações": { is_ok: false, dir: -1, mult: 1, degrau_valor: 1, msg_simplificada: 'NOK (pouco alto)' },
        "OK": { is_ok: true, dir: 0, mult: 0, degrau_valor: 0, msg_simplificada: 'OK' },
        "Eu sinto que não tenho força suficiente no motor durante as retas": { is_ok: false, dir: 1, mult: 1, degrau_valor: -1, msg_simplificada: 'NOK (pouco baixo)' },
        "A força do motor nas retas não é suficiente": { is_ok: false, dir: 1, mult: 1, degrau_valor: -2, msg_simplificada: 'NOK (baixo)' },
        "Você deve tentar favorecer muito mais as altas rotações": { is_ok: false, dir: 1, mult: 2, degrau_valor: -3, msg_simplificada: 'NOK (muito baixo)' },
    },
    "FREIOS": {
        "Por favor, coloque o balanço dos freios muito mais para trás": { is_ok: false, dir: -1, mult: 2, degrau_valor: 3, msg_simplificada: 'NOK (muito p/ trás)' },
        "Eu penso que a eficácia dos freios pode ser maior se movermos o balanço para trás": { is_ok: false, dir: -1, mult: 1, degrau_valor: 2, msg_simplificada: 'NOK (p/ trás)' },
        "Coloque o balanço um pouco mais para trás": { is_ok: false, dir: -1, mult: 1, degrau_valor: 1, msg_simplificada: 'NOK (pouco p/ trás)' },
        "OK": { is_ok: true, dir: 0, mult: 0, degrau_valor: 0, msg_simplificada: 'OK' },
        "Eu gostaria de ter o balanço um pouco mais para frente": { is_ok: false, dir: 1, mult: 1, degrau_valor: -1, msg_simplificada: 'NOK (pouco p/ frente)' },
        "Eu penso que a eficácia dos freios pode ser maior se movermos o balanço para frente": { is_ok: false, dir: 1, mult: 1, degrau_valor: -2, msg_simplificada: 'NOK (p/ frente)' },
        "Eu me sentiria muito mais confortável se movêssemos o balanço para a frente": { is_ok: false, dir: 1, mult: 2, degrau_valor: -3, msg_simplificada: 'NOK (muito p/ frente)' },
    },
    "CÂMBIO": {
        "Por favor, coloque um pouco menor o intervalo entre as marchas.": { is_ok: false, dir: -1, mult: 2, degrau_valor: 3, msg_simplificada: 'NOK (muito longo)' },
        "A relação do câmbio é muito longa": { is_ok: false, dir: -1, mult: 1, degrau_valor: 2, msg_simplificada: 'NOK (longo)' },
        "Eu não posso tirar vantagem da força do motor. Coloque a relação do câmbio um pouco menor": { is_ok: false, dir: -1, mult: 1, degrau_valor: 1, msg_simplificada: 'NOK (pouco longo)' },
        "OK": { is_ok: true, dir: 0, mult: 0, degrau_valor: 0, msg_simplificada: 'OK' },
        "Estou muito frequentemente no vermelho. Coloque a relação do câmbio um pouco mais alta": { is_ok: false, dir: 1, mult: 1, degrau_valor: -1, msg_simplificada: 'NOK (pouco curto)' },
        "A relação do câmbio está muito curta": { is_ok: false, dir: 1, mult: 1, degrau_valor: -2, msg_simplificada: 'NOK (curto)' },
        "Eu sinto que o motor vai explodir. Coloque o intervalo de marchas bem maior.": { is_ok: false, dir: 1, mult: 2, degrau_valor: -3, msg_simplificada: 'NOK (muito curto)' },
    },
    "SUSPENSÃO": {
        "O carro está rígido demais. Diminua muito mais a rigidez": { is_ok: false, dir: -1, mult: 2, degrau_valor: 3, msg_simplificada: 'NOK (muito rígido)' },
        "A rigidez da suspensão está muito alta": { is_ok: false, dir: -1, mult: 1, degrau_valor: 2, msg_simplificada: 'NOK (rígido)' },
        "O carro está muito rígido. Diminua um pouco a rigidez": { is_ok: false, dir: -1, mult: 1, degrau_valor: 1, msg_simplificada: 'NOK (pouco rígido)' },
        "OK": { is_ok: true, dir: 0, mult: 0, degrau_valor: 0, msg_simplificada: 'OK' },
        "Eu penso que com uma suspensão um pouco mais rígida eu poderei ir mais rápido": { is_ok: false, dir: 1, mult: 1, degrau_valor: -1, msg_simplificada: 'NOK (pouco macio)' },
        "A rigidez da suspensão está muito baixa": { is_ok: false, dir: 1, mult: 1, degrau_valor: -2, msg_simplificada: 'NOK (macio)' },
        "A rigidez da suspensão deve ser muito maior": { is_ok: false, dir: 1, mult: 2, degrau_valor: -3, msg_simplificada: 'NOK (muito macio)' },
    }
};

const DISPLAY_TO_LOGIC: Record<string, string> = {
    "Asa Dianteira": "ASAS", "Asa Traseira": "ASAS", "Motor": "MOTOR",
    "Freios": "FREIOS", "Câmbio": "CÂMBIO", "Suspensão": "SUSPENSÃO"
};

const roundHalfUp = (n: number) => Math.floor(n + 0.5);
const applyBounds = (val: number) => Math.max(1, Math.min(1000, val));

// --- LÓGICA DE FILTRAGEM (NOVA) ---
// Replica a função populate_feedback_combos do Python
function calculateAllowedFeedbacks(logicPart: string, history: any[]) {
    const partHistory = history.map(h => h);
    
    // Buscar último OK e último NOK
    let lastOk = null;
    let lastNok = null;

    for (let i = partHistory.length - 1; i >= 0; i--) {
        if (partHistory[i].is_ok && lastOk === null) lastOk = partHistory[i].acerto;
        if (!partHistory[i].is_ok && lastNok === null) lastNok = partHistory[i].acerto;
        if (lastOk !== null && lastNok !== null) break;
    }

    const inBisectionMode = lastOk !== null && lastNok !== null;
    let allowedOptions: string[] = [];

    // Pegar todas as opções possíveis da peça com seus dados
    const allOptions = Object.entries(FEEDBACK_MAP[logicPart]).map(([msg, data]) => ({ msg, ...data }));

    if (inBisectionMode) {
        let expectedNokDir = 0;
        if (lastNok! > lastOk!) expectedNokDir = -1; // NOK estava acima, esperamos feedback "baixar"
        else if (lastNok! < lastOk!) expectedNokDir = 1; // NOK estava abaixo, esperamos feedback "subir"

        let nokOptionToAdd: string | null = null;

        if (expectedNokDir !== 0) {
            // Filtra opções NOK com mult=1 e na direção esperada
            const relevantOptions = allOptions
                .filter(o => !o.is_ok && o.mult === 1 && o.dir === expectedNokDir)
                .sort((a, b) => Math.abs(a.degrau_valor) - Math.abs(b.degrau_valor));
            
            if (relevantOptions.length > 0) nokOptionToAdd = relevantOptions[0].msg;
        }

        // Reconstrói a lista: OK + Opção NOK relevante
        allOptions.forEach(opt => {
            if (opt.is_ok) allowedOptions.push(opt.msg);
            else if (opt.msg === nokOptionToAdd) allowedOptions.push(opt.msg);
        });

        if (allowedOptions.length === 0) allowedOptions.push("OK");

    } else {
        // Modo sondagem: retorna todas as opções
        allowedOptions = allOptions.map(o => o.msg);
    }

    return allowedOptions;
}

// ... (Funções calculateNextSuggestion e calculateFinalAnalysis permanecem iguais ao código anterior)
function calculateNextSuggestion(logicPart: string, history: any[], zsTotal: number, zsHalf: number) {
    if (history.length === 0) return 500;
    const partHistory = history.map(h => h);
    const lastEntry = partHistory[partHistory.length - 1];
    const lastAcerto = lastEntry.acerto;
    const allAcertos = new Set(partHistory.map(h => h.acerto));
    let lastOk = null;
    let lastNok = null;
    for (let i = partHistory.length - 1; i >= 0; i--) {
        if (partHistory[i].is_ok && lastOk === null) lastOk = partHistory[i].acerto;
        if (!partHistory[i].is_ok && lastNok === null) lastNok = partHistory[i].acerto;
        if (lastOk !== null && lastNok !== null) break;
    }
    let suggestion = lastAcerto;
    if (lastOk !== null && lastNok !== null) {
        const diff = Math.abs(lastOk - lastNok);
        if (diff <= 2) return lastOk; 
        const minVal = Math.min(lastOk, lastNok);
        const maxVal = Math.max(lastOk, lastNok);
        suggestion = roundHalfUp((minVal + maxVal) / 2);
        let originalSugestao = suggestion;
        let foundNew = false;
        let testSug = originalSugestao;
        while (testSug <= maxVal) {
            if (!allAcertos.has(testSug)) {
                suggestion = testSug;
                foundNew = true;
                break;
            }
            testSug++;
        }
        if (!foundNew) {
            testSug = originalSugestao - 1;
            while (testSug >= minVal) {
                if (!allAcertos.has(testSug)) {
                    suggestion = testSug;
                    foundNew = true;
                    break;
                }
                testSug--;
            }
        }
        if (!foundNew) suggestion = lastOk; 
        return applyBounds(suggestion);
    }
    if (!lastEntry.is_ok) {
        suggestion = lastAcerto + (lastEntry.dir * lastEntry.mult * zsTotal);
        return applyBounds(suggestion);
    }
    let direction = 1;
    if (["ASAS", "CÂMBIO", "SUSPENSÃO"].includes(logicPart)) direction = -1;
    else direction = 1;
    let currentStep = zsHalf;
    let consecutiveOks = 0;
    for (let i = partHistory.length - 1; i >= 0; i--) {
        if (partHistory[i].is_ok) consecutiveOks++;
        else break;
    }
    if (consecutiveOks > 1) {
        for(let i = 1; i < consecutiveOks; i++) {
            currentStep = Math.max(1, roundHalfUp(currentStep / 2));
        }
    }
    suggestion = lastAcerto + (direction * currentStep);
    let retries = 0;
    while (allAcertos.has(suggestion) && retries < 5) {
        if (currentStep === 1) {
            suggestion = lastAcerto;
            break;
        }
        suggestion += direction;
        retries++;
    }
    return applyBounds(suggestion);
}

function calculateFinalAnalysis(logicPart: string, history: any[], zsTotal: number, zsHalf: number) {
    if (history.length === 0) return { final: "—", margin: "—" };
    let lastOk = null;
    let lastNok = null;
    let lastNokDir = null;
    for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].is_ok && lastOk === null) lastOk = history[i].acerto;
        if (!history[i].is_ok && lastNok === null) {
            lastNok = history[i].acerto;
            lastNokDir = history[i].dir;
        }
        if (lastOk !== null && lastNok !== null) break;
    }
    if (lastOk === null) return { final: "N/A", margin: "N/A" };
    let acertoIdeal = 0;
    let margin = "—";
    if (lastNok === null) {
        let dir = ["ASAS", "CÂMBIO", "SUSPENSÃO"].includes(logicPart) ? -1 : 1;
        acertoIdeal = applyBounds(lastOk + (dir * zsHalf));
        margin = `±${zsHalf}`;
    } else {
        let diff = Math.abs(lastOk - lastNok);
        if (logicPart === "FREIOS") {
             if (lastNok > lastOk) acertoIdeal = lastOk - zsHalf;
             else acertoIdeal = lastOk + zsHalf;
        } else {
             if (lastNok > lastOk) acertoIdeal = lastOk - zsHalf;
             else acertoIdeal = lastOk + zsHalf;
        }
        acertoIdeal = applyBounds(acertoIdeal);
        if (diff <= 2) margin = "0";
        else margin = `±${Math.floor(diff/2)}`;
    }
    return { final: acertoIdeal, margin };
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { driver, history, currentLapData } = body; 

        const xp = Number(driver.xp);
        const ct = Number(driver.ct);
        const zsRaw = 136 - (0.11555 * xp) - (0.29895 * ct);
        const zsTotal = roundHalfUp(zsRaw);
        const zsHalf = roundHalfUp(zsTotal / 2);

        const processedLap: any = {};
        const displayParts = Object.keys(currentLapData);

        displayParts.forEach(displayPart => {
            const logicPart = DISPLAY_TO_LOGIC[displayPart];
            const inputData = currentLapData[displayPart];
            let feedbackInfo = FEEDBACK_MAP[logicPart][inputData.msg];
            if (!feedbackInfo) feedbackInfo = FEEDBACK_MAP[logicPart]["OK"]; 

            processedLap[displayPart] = {
                acerto: Number(inputData.acerto),
                msg: inputData.msg,
                ...feedbackInfo,
                logicPart
            };
        });

        const fullHistory = [...history, processedLap];

        const nextSuggestions: any = {};
        const finalAnalysis: any = {};
        const allowedOptions: any = {}; // Novo objeto para opções filtradas

        displayParts.forEach(displayPart => {
            const logicPart = DISPLAY_TO_LOGIC[displayPart];
            const partHistory = fullHistory.map((lap: any) => lap[displayPart]);
            
            nextSuggestions[displayPart] = calculateNextSuggestion(logicPart, partHistory, zsTotal, zsHalf);
            finalAnalysis[displayPart] = calculateFinalAnalysis(logicPart, partHistory, zsTotal, zsHalf);
            
            // Calcula as opções permitidas para a PRÓXIMA volta
            allowedOptions[displayPart] = calculateAllowedFeedbacks(logicPart, partHistory);
        });

        return NextResponse.json({
            sucesso: true,
            data: {
                processedLap,
                nextSuggestions,
                finalAnalysis,
                allowedOptions, // Retorna para o front
                zs: { total: zsTotal, half: zsHalf }
            }
        });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ sucesso: false, erro: "Erro interno" }, { status: 500 });
    }
}