// --- CONFIGURAÇÃO INICIAL E ESTADO ---
let dataExibida = new Date();
let timerInterval;
let tarefaAtivaId = null;

// --- NAVEGAÇÃO ENTRE MESES ---

function getChaveMes() {
    return `kanban_${dataExibida.getFullYear()}_${dataExibida.getMonth()}`;
}

function atualizarDisplayMes() {
    const nomesMeses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const display = document.getElementById("mes-display");
    const textoMes = `${nomesMeses[dataExibida.getMonth()]} / ${dataExibida.getFullYear()}`;
    display.textContent = textoMes;
    
    const btnDash = document.querySelector(".btn-estatisticas");
    if (btnDash) {
        btnDash.href = `dashboard.html?mes=${dataExibida.getMonth()}&ano=${dataExibida.getFullYear()}`;
    }
    carregarDados();
}

// --- PERSISTÊNCIA (LOCAL E NUVEM) ---

async function salvarDados() {
    const chave = getChaveMes();
    const dados = {
        todo: extrairDadosColuna("todo"),
        doing: extrairDadosColuna("doing"),
        done: extrairDadosColuna("done")
    };

    localStorage.setItem(chave, JSON.stringify(dados));

    if (window.db) {
        try {
            const { doc, setDoc } = window.fsMethods;
            await setDoc(doc(window.db, "meses", chave), dados);
        } catch (e) { console.error("Erro Firebase:", e); }
    }
}

async function carregarDados() {
    const chave = getChaveMes();
    limparColunasVisuais();

    // 1. Tenta carregar local primeiro
    const dadosLocais = localStorage.getItem(chave);
    if (dadosLocais) renderizarKanban(JSON.parse(dadosLocais));

    // 2. Busca na nuvem para atualizar/sincronizar
    if (window.db) {
        const { doc, getDoc } = window.fsMethods;
        const snap = await getDoc(doc(window.db, "meses", chave));
        if (snap.exists()) {
            const dadosNuvem = snap.data();
            localStorage.setItem(chave, JSON.stringify(dadosNuvem));
            limparColunasVisuais();
            renderizarKanban(dadosNuvem);
        }
    }
}

function extrairDadosColuna(id) {
    return Array.from(document.getElementById(id).querySelectorAll(".cartao")).map(c => ({
        id: c.dataset.id,
        texto: c.querySelector("span").textContent,
        prioridade: c.dataset.prioridade
    }));
}

function renderizarKanban(dados) {
    if (!dados) return;
    Object.keys(dados).forEach(colunaId => {
        dados[colunaId].forEach(t => {
            const cartao = criarCartao(t.texto, t.id, t.prioridade);
            document.getElementById(colunaId).appendChild(cartao);
        });
    });
}

function limparColunasVisuais() {
    ["todo", "doing", "done"].forEach(id => {
        const col = document.getElementById(id);
        Array.from(col.querySelectorAll(".cartao")).forEach(c => c.remove());
    });
}

// --- LÓGICA DO KANBAN ---

function adicionarTarefa() {
    const titulo = document.getElementById("titulo").value;
    const coluna = document.getElementById("colunaDestino").value;
    const prioridade = document.getElementById("prioridade").value;

    if (!titulo) return alert("Digite um título!");

    const id = "task-" + Date.now();
    const cartao = criarCartao(titulo, id, prioridade);
    document.getElementById(coluna).appendChild(cartao);
    
    document.getElementById("titulo").value = "";
    salvarDados();
}

function criarCartao(texto, id, prioridade) {
    const cartao = document.createElement("div");
    
    // Garante que a classe de prioridade seja aplicada (ex: prio-alta)
    cartao.className = `cartao prio-${prioridade}`; 
    cartao.draggable = true;
    cartao.dataset.id = id;
    cartao.dataset.prioridade = prioridade;

    // Estrutura interna: Ícone de prioridade + Texto + Botão de fechar com ícone
    cartao.innerHTML = `
        <div class="cartao-conteudo">
            <i class="fa-solid fa-circle" style="font-size: 10px; margin-right: 8px;"></i>
            <span>${texto}</span>
        </div>
        <button class="btn-del" title="Excluir tarefa">
            <i class="fa-solid fa-xmark"></i>
        </button>
    `;

    // Evento de Drag
    cartao.ondragstart = (e) => {
        e.dataTransfer.setData("text", id);
        cartao.classList.add("arrastando");
    };

    cartao.ondragend = () => cartao.classList.remove("arrastando");
    
    // Evento de Excluir
    cartao.querySelector(".btn-del").onclick = (e) => {
        e.stopPropagation(); // Evita abrir o pomodoro ao excluir
        cartao.remove();
        salvarDados();
    };

    // Clique para Pomodoro (apenas na coluna Doing)
    cartao.onclick = () => {
        if (cartao.parentElement && cartao.parentElement.id === "doing") {
            abrirPomodoro(id, texto);
        }
    };

    return cartao;
}

// --- DRAG AND DROP ---
function allowDrop(e) { e.preventDefault(); }
function drop(e) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text");
    const cartao = document.querySelector(`[data-id="${id}"]`);
    const colunaAlvo = e.target.closest(".coluna");
    if (colunaAlvo && cartao) {
        colunaAlvo.appendChild(cartao);
        salvarDados();
    }
}

// --- POMODORO ---

function abrirPomodoro(id, titulo) {
    tarefaAtivaId = id;
    document.getElementById("pomo-tarefa-titulo").textContent = `Foco: ${titulo}`;
    document.getElementById("pomodoro-container").style.display = "block";
}

document.getElementById("fechar-pomo").onclick = () => {
    document.getElementById("pomodoro-container").style.display = "none";
    clearInterval(timerInterval);
};

document.getElementById("pomo-start").onclick = function() {
    const btn = this;
    if (btn.innerHTML.includes("Iniciar")) {
        btn.innerHTML = '<i class="fa-solid fa-pause"></i> Parar';
        let mins = parseInt(document.getElementById("pomo-minutos").value);
        iniciarTimer(mins);
    } else {
        btn.innerHTML = '<i class="fa-solid fa-play"></i> Iniciar';
        clearInterval(timerInterval);
    }
};

function iniciarTimer(minutos) {
    clearInterval(timerInterval);
    let tempo = minutos * 60;
    const display = document.getElementById("tempo-restante");

    timerInterval = setInterval(() => {
        let m = Math.floor(tempo / 60);
        let s = tempo % 60;
        display.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        if (tempo <= 0) {
            clearInterval(timerInterval);
            alert("⏰ Tempo finalizado! Hora de uma pausa.");
            salvarHistoricoPomo(tarefaAtivaId, minutos);
            document.getElementById("pomo-start").innerHTML = '<i class="fa-solid fa-play"></i> Iniciar';
        }
        tempo--;
    }, 1000);
}

async function salvarHistoricoPomo(idTarefa, minutos) {
    const chave = `pomo_history_${getChaveMes()}`;
    let hist = JSON.parse(localStorage.getItem(chave)) || [];
    const novoPomo = { id: idTarefa, data: new Date().toISOString(), tempo: minutos };
    hist.push(novoPomo);
    localStorage.setItem(chave, JSON.stringify(hist));

    if (window.db) {
        const { doc, setDoc } = window.fsMethods;
        await setDoc(doc(window.db, "pomodoro", `${chave}_${Date.now()}`), novoPomo);
    }
}

// --- EVENTOS DE INTERFACE ---

document.getElementById("mes-anterior").onclick = () => {
    dataExibida.setMonth(dataExibida.getMonth() - 1);
    atualizarDisplayMes();
};

document.getElementById("proximo-mes").onclick = () => {
    dataExibida.setMonth(dataExibida.getMonth() + 1);
    atualizarDisplayMes();
};

document.getElementById("limpar").onclick = () => {
    if (confirm("Limpar todas as tarefas deste mês?")) {
        localStorage.removeItem(getChaveMes());
        location.reload();
    }
};

// Inicialização Inteligente (verifica se vem do Dashboard)
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.has('mes')) {
    dataExibida.setMonth(urlParams.get('mes'));
    dataExibida.setFullYear(urlParams.get('ano'));
}

atualizarDisplayMes();
