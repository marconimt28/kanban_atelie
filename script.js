// --- CONFIGURAÇÃO INICIAL E ESTADO ---
let dataExibida = new Date(); 
let ultimaTarefaExcluida = null;
let timeoutDesfazer = null;
let timerInterval;
let tarefaAtivaId = null;

// --- NAVEGAÇÃO ENTRE MESES E INTEGRAÇÃO ---

function getChaveMes() {
    return `kanban_${dataExibida.getFullYear()}_${dataExibida.getMonth()}`;
}

function atualizarDisplayMes() {
    const nomesMeses = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];
    const display = document.getElementById("mes-display");
    const modalRef = document.getElementById("mes-modal-ref");
    
    const textoMes = `${nomesMeses[dataExibida.getMonth()]} / ${dataExibida.getFullYear()}`;
    if (display) display.textContent = textoMes;
    if (modalRef) modalRef.textContent = textoMes;
}

function atualizarLinkDashboard() {
    const btnDash = document.querySelector(".btn-estatisticas");
    if (btnDash) {
        const mes = dataExibida.getMonth();
        const ano = dataExibida.getFullYear();
        btnDash.href = `dashboard.html?mes=${mes}&ano=${ano}`;
    }
}

document.getElementById("mes-anterior").addEventListener("click", () => {
    dataExibida.setMonth(dataExibida.getMonth() - 1);
    resetarTelaECarregar();
});

document.getElementById("proximo-mes").addEventListener("click", () => {
    dataExibida.setMonth(dataExibida.getMonth() + 1);
    resetarTelaECarregar();
});

function resetarTelaECarregar() {
    atualizarDisplayMes();
    carregarTarefas();
    atualizarLinkDashboard();
}

// --- PERSISTÊNCIA (LOCAL E FIREBASE) ---

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
            console.log("☁️ Sincronizado com Firebase");
        } catch (e) {
            console.error("Erro ao salvar no Firebase:", e);
        }
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
        } catch (e) {
            console.error("Erro ao buscar do Firebase:", e);
        }
    }
}

function limparColunasVisuais() {
    ["todo", "doing", "done"].forEach(id => {
        const col = document.getElementById(id);
        if (col) {
            const h2 = col.querySelector("h2").outerHTML;
            col.innerHTML = h2;
        }
    });
}

function renderizarDados(dados) {
    Object.keys(dados).forEach(colunaId => {
        const colunaElement = document.getElementById(colunaId);
        if (colunaElement) {
            dados[colunaId].forEach(item => {
                const cartao = criarCartao(item.texto, "c" + Math.random(), colunaId, item.prioridade);
                colunaElement.appendChild(cartao);
            });
            ordenarColuna(colunaId);
        }
    });
}

// --- GESTÃO DE TAREFAS ---

function criarCartao(texto, id, colunaId, prioridade = 'baixa') {
    const cartao = document.createElement("div");
    cartao.classList.add("cartao", prioridade);
    cartao.dataset.id = id;

    const btnExcluir = document.createElement("button");
    btnExcluir.innerHTML = "×";
    btnExcluir.classList.add("btn-excluir");
    btnExcluir.addEventListener("click", (e) => {
        e.stopPropagation();
        ultimaTarefaExcluida = {
            elemento: cartao,
            pai: cartao.parentElement,
            posicao: Array.from(cartao.parentElement.children).indexOf(cartao)
        };
        cartao.remove();
        salvarDados();
        mostrarToastDesfazer();
    });

    const spanTexto = document.createElement("span");
    spanTexto.textContent = texto;

    const emoji = document.createElement("span");
    emoji.classList.add("emoji-label");
    const icon = document.createElement("i");
    icon.classList.add("fa-solid");
    
    if (colunaId === "todo") icon.classList.add("fa-clipboard-list");
    if (colunaId === "doing") icon.classList.add("fa-spinner", "fa-spin");
    if (colunaId === "done") icon.classList.add("fa-circle-check");
    emoji.appendChild(icon);

    cartao.appendChild(spanTexto);
    cartao.appendChild(emoji);
    cartao.appendChild(btnExcluir);

    cartao.setAttribute("draggable", true);
    cartao.addEventListener("dragstart", (e) => {
        cartao.classList.add("arrastando");
    });
    
    cartao.addEventListener("dragend", () => {
        cartao.classList.remove("arrastando");
    });

    cartao.addEventListener("click", () => {
        if (cartao.parentElement && cartao.parentElement.id === "doing") {
            abrirPomodoro(id, texto);
        }
    });

    cartao.addEventListener("dblclick", () => {
        const novoTexto = prompt("Editar tarefa:", spanTexto.textContent);
        if (novoTexto) {
            spanTexto.textContent = novoTexto.trim();
            salvarDados();
        }
    });

    return cartao;
}

window.adicionarTarefa = function() {
    const inputTitulo = document.getElementById("titulo");
    const selectColuna = document.getElementById("colunaDestino");
    const selectPrioridade = document.getElementById("prioridade");

    if (!inputTitulo) return;

    const titulo = inputTitulo.value.trim();
    const colunaDestino = selectColuna.value;
    const prioridade = selectPrioridade.value;

    if (titulo !== "") {
        const novoCartao = criarCartao(titulo, "c" + Date.now(), colunaDestino, prioridade);
        const container = document.getElementById(colunaDestino);
        if (container) {
            container.appendChild(novoCartao);
            inputTitulo.value = ""; 
            salvarDados();
            ordenarColuna(colunaDestino);
        }
    } else {
        alert("Por favor, digite o título da tarefa.");
    }
};

// --- POMODORO ---

function abrirPomodoro(id, titulo) {
    tarefaAtivaId = id;
    const container = document.getElementById("pomodoro-container");
    document.getElementById("pomo-tarefa-titulo").textContent = titulo;
    if (container) container.style.display = "block";
}

document.getElementById("fechar-pomo").onclick = () => {
    document.getElementById("pomodoro-container").style.display = "none";
    clearInterval(timerInterval);
};

document.getElementById("pomo-start").onclick = function() {
    if (this.textContent.includes("Iniciar")) {
        this.innerHTML = '<i class="fa-solid fa-pause"></i> Parar';
        iniciarTimer(parseInt(document.getElementById("pomo-minutos").value));
    } else {
        this.innerHTML = '<i class="fa-solid fa-play"></i> Iniciar';
        clearInterval(timerInterval);
    }
};

function iniciarTimer(minutos) {
    let tempo = minutos * 60;
    const display = document.getElementById("tempo-restante");
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        let m = Math.floor(tempo / 60);
        let s = tempo % 60;
        display.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        if (tempo <= 0) {
            clearInterval(timerInterval);
            alert("⏰ Tempo finalizado!");
            salvarHistoricoPomo(minutos);
            document.getElementById("pomo-start").innerHTML = '<i class="fa-solid fa-play"></i> Iniciar';
        }
        tempo--;
    }, 1000);
}

async function salvarHistoricoPomo(minutos) {
    const chave = `pomo_history_${getChaveMes()}`;
    let hist = JSON.parse(localStorage.getItem(chave)) || [];
    hist.push({ id: tarefaAtivaId, data: new Date().toISOString(), tempo: minutos });
    localStorage.setItem(chave, JSON.stringify(hist));
    
    if (window.db) {
        try {
            const { doc, setDoc } = window.fsMethods;
            await setDoc(doc(window.db, "pomodoro", `${chave}_${Date.now()}`), { 
                tempo: minutos, 
                data: new Date().toISOString(),
                tarefaId: tarefaAtivaId 
            });
        } catch(e) { console.error(e); }
    }
}

// --- ORDENAÇÃO ---

function ordenarColuna(colunaId) {
    const coluna = document.getElementById(colunaId);
    if (!coluna) return;
    const cartoes = Array.from(coluna.querySelectorAll(".cartao"));
    const ordem = { alta: 1, media: 2, baixa: 3 };

    cartoes.sort((a, b) => {
        const pA = a.classList.contains('alta') ? 'alta' : a.classList.contains('media') ? 'media' : 'baixa';
        const pB = b.classList.contains('alta') ? 'alta' : b.classList.contains('media') ? 'media' : 'baixa';
        return ordem[pA] - ordem[pB];
    });
    cartoes.forEach(c => coluna.appendChild(c));
}

// --- TOAST E LIMPEZA ---

function mostrarToastDesfazer() {
    const existente = document.getElementById("toast-undo");
    if (existente) existente.remove();
    const toast = document.createElement("div");
    toast.id = "toast-undo";
    toast.innerHTML = `<span>Tarefa removida</span><button onclick="window.desfazerExclusao()">Desfazer</button>`;
    document.body.appendChild(toast);
    timeoutDesfazer = setTimeout(() => { if (toast.parentNode) toast.remove(); }, 5000);
}

window.desfazerExclusao = function() {
    if (ultimaTarefaExcluida) {
        const { elemento, pai, posicao } = ultimaTarefaExcluida;
        pai.insertBefore(elemento, pai.children[posicao] || null);
        salvarDados();
        if (document.getElementById("toast-undo")) document.getElementById("toast-undo").remove();
        ultimaTarefaExcluida = null;
    }
};

document.getElementById("limpar").onclick = () => {
    if (confirm("Limpar tarefas deste mês?")) {
        localStorage.removeItem(getChaveMes());
        resetarTelaECarregar();
    }
};

// --- FUNÇÕES DE DRAG & DROP (CHAMADAS PELO HTML) ---

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

// --- INICIALIZAÇÃO (CHAMADA POR ÚLTIMO) ---
function inicializar() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('mes')) {
        dataExibida.setMonth(parseInt(urlParams.get('mes')));
        dataExibida.setFullYear(parseInt(urlParams.get('ano')));
    }
    resetarTelaECarregar();
}

// Garante que as funções window.drop já existam antes de carregar dados
inicializar();
