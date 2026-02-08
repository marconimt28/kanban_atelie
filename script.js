// --- 1. REGISTRO GLOBAL IMEDIATO ---
window.allowDrop = function(event) {
    event.preventDefault();
};

window.drop = function(event) {
    event.preventDefault();
    const arrastando = document.querySelector(".arrastando");
    const colunaAlvo = event.target.closest(".coluna");
    
    if (arrastando && colunaAlvo) {
        colunaAlvo.appendChild(arrastando);
        const colunaId = colunaAlvo.id;
        const icon = arrastando.querySelector(".emoji-label i");
        if (icon) {
            icon.className = "fa-solid";
            if (colunaId === "todo") icon.classList.add("fa-clipboard-list");
            if (colunaId === "doing") icon.classList.add("fa-spinner", "fa-spin");
            if (colunaId === "done") icon.classList.add("fa-circle-check");
        }
        salvarDados();
        ordenarColuna(colunaId);
    }
};

// --- 2. ESTADO GLOBAL ---
let dataExibida = new Date(); 
let ultimaTarefaExcluida = null;
let timerInterval;
let tarefaAtivaId = null;

const getChaveMes = () => `kanban_${dataExibida.getFullYear()}_${dataExibida.getMonth()}`;

// --- 3. PERSISTÊNCIA & FIREBASE ---
async function salvarDados() {
    const chave = getChaveMes();
    const dados = { todo: [], doing: [], done: [] };
    
    ["todo", "doing", "done"].forEach(coluna => {
        document.querySelectorAll(`#${coluna} .cartao`).forEach(c => {
            dados[coluna].push({
                texto: c.querySelector("span").textContent,
                prioridade: c.classList.contains('alta') ? 'alta' : c.classList.contains('media') ? 'media' : 'baixa'
            });
        });
    });

    localStorage.setItem(chave, JSON.stringify(dados));
    if (window.db) {
        try {
            const { doc, setDoc } = window.fsMethods;
            await setDoc(doc(window.db, "meses", chave), dados);
        } catch (e) { console.error("Erro Firebase:", e); }
    }
}

async function carregarTarefas() {
    const chave = getChaveMes();
    limparColunasVisuais();
    const dadosLocais = JSON.parse(localStorage.getItem(chave));
    if (dadosLocais) renderizarDados(dadosLocais);

    if (window.db) {
        try {
            const { doc, getDoc } = window.fsMethods;
            const snap = await getDoc(doc(window.db, "meses", chave));
            if (snap.exists()) {
                const dadosNuvem = snap.data();
                localStorage.setItem(chave, JSON.stringify(dadosNuvem));
                limparColunasVisuais();
                renderizarDados(dadosNuvem);
            }
        } catch (e) { console.error(e); }
    }
}

// --- 4. INTERFACE & NAVEGAÇÃO ---
function atualizarDisplayMes() {
    const nomes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const texto = `${nomes[dataExibida.getMonth()]} / ${dataExibida.getFullYear()}`;
    document.getElementById("mes-display").textContent = texto;
    document.getElementById("mes-modal-ref").textContent = texto;
    
    const btnDash = document.querySelector(".btn-estatisticas");
    if (btnDash) btnDash.href = `dashboard.html?mes=${dataExibida.getMonth()}&ano=${dataExibida.getFullYear()}`;
}

function criarCartao(texto, id, colunaId, prioridade = 'baixa') {
    const cartao = document.createElement("div");
    cartao.classList.add("cartao", prioridade);
    cartao.dataset.id = id;
    cartao.setAttribute("draggable", true);

    const btnExcluir = document.createElement("button");
    btnExcluir.innerHTML = "×";
    btnExcluir.classList.add("btn-excluir");
    btnExcluir.onclick = (e) => {
        e.stopPropagation();
        ultimaTarefaExcluida = { elemento: cartao, pai: cartao.parentElement, posicao: Array.from(cartao.parentElement.children).indexOf(cartao) };
        cartao.remove();
        salvarDados();
        mostrarToastDesfazer();
    };

    const emoji = document.createElement("span");
    emoji.classList.add("emoji-label");
    const icon = document.createElement("i");
    icon.className = `fa-solid ${colunaId === 'todo' ? 'fa-clipboard-list' : colunaId === 'doing' ? 'fa-spinner fa-spin' : 'fa-circle-check'}`;
    emoji.appendChild(icon);

    cartao.innerHTML = `<span>${texto}</span>`;
    cartao.appendChild(emoji);
    cartao.appendChild(btnExcluir);

    cartao.ondragstart = () => cartao.classList.add("arrastando");
    cartao.ondragend = () => cartao.classList.remove("arrastando");
    cartao.onclick = () => { if (cartao.parentElement.id === "doing") abrirPomodoro(id, texto); };

    return cartao;
}

window.adicionarTarefa = function() {
    const input = document.getElementById("titulo");
    const col = document.getElementById("colunaDestino").value;
    const prio = document.getElementById("prioridade").value;
    if (input.value.trim() !== "") {
        const novo = criarCartao(input.value.trim(), "c" + Date.now(), col, prio);
        document.getElementById(col).appendChild(novo);
        input.value = ""; 
        salvarDados();
        ordenarColuna(col);
    }
};

// --- 5. RELATÓRIO E LIMPAR ---
document.getElementById("abrir-relatorio").onclick = () => {
    const dados = JSON.parse(localStorage.getItem(getChaveMes())) || { todo: [], doing: [], done: [] };
    let html = "<ul>";
    const cats = { todo: "A Fazer", doing: "Em Progresso", done: "Concluído" };
    Object.keys(cats).forEach(c => {
        html += `<li><strong>${cats[c]}:</strong> ${dados[c].length}</li>`;
        dados[c].forEach(t => html += `<li style="margin-left:20px small;">${t.prioridade === 'alta' ? '🔴' : t.prioridade === 'media' ? '🟡' : '🟢'} ${t.texto}</li>`);
    });
    document.getElementById("conteudo-relatorio").innerHTML = html + "</ul>";
    document.getElementById("modal-relatorio").style.display = "flex";
};

document.getElementById("limpar").onclick = async () => {
    if (confirm("Limpar este mês?")) {
        const chave = getChaveMes();
        localStorage.removeItem(chave);
        if (window.db) await window.fsMethods.setDoc(window.fsMethods.doc(window.db, "meses", chave), { todo: [], doing: [], done: [] });
        resetarTelaECarregar();
    }
};

// --- INICIALIZAÇÃO ---
document.getElementById("mes-anterior").onclick = () => { dataExibida.setMonth(dataExibida.getMonth() - 1); resetarTelaECarregar(); };
document.getElementById("proximo-mes").onclick = () => { dataExibida.setMonth(dataExibida.getMonth() + 1); resetarTelaECarregar(); };
document.getElementById("fechar-relatorio").onclick = () => document.getElementById("modal-relatorio").style.display = "none";

function limparColunasVisuais() { ["todo", "doing", "done"].forEach(id => { const col = document.getElementById(id); const h2 = col.querySelector("h2"); col.innerHTML = ""; col.appendChild(h2); }); }
function renderizarDados(dados) { Object.keys(dados).forEach(id => { (dados[id] || []).forEach(item => document.getElementById(id).appendChild(criarCartao(item.texto, Math.random(), id, item.prioridade))); ordenarColuna(id); }); }
function ordenarColuna(id) { const col = document.getElementById(id); const cards = Array.from(col.querySelectorAll(".cartao")); const peso = { alta: 1, media: 2, baixa: 3 }; cards.sort((a, b) => peso[a.classList[1]] - peso[b.classList[1]]).forEach(c => col.appendChild(c)); }

function resetarTelaECarregar() { atualizarDisplayMes(); carregarTarefas(); }
atualizarDisplayMes();
carregarTarefas();
