// --- CONFIGURAÇÃO INICIAL E ESTADO ---
let dataExibida = new Date(); // Começa no mês atual
let ultimaTarefaExcluida = null;
let timeoutDesfazer = null;

// --- NAVEGAÇÃO ENTRE MESES E INTEGRAÇÃO ---

function getChaveMes() {
    // Chave única por mês: ex "kanban_2026_0"
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
    display.textContent = textoMes;
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

// --- LÓGICA DE DESFAZER (UNDO) ---

window.desfazerExclusao = function() {
    if (ultimaTarefaExcluida) {
        const { elemento, pai, posicao } = ultimaTarefaExcluida;
        if (posicao >= pai.children.length) {
            pai.appendChild(elemento);
        } else {
            pai.insertBefore(elemento, pai.children[posicao]);
        }
        salvarTarefas();
        const toast = document.getElementById("toast-undo");
        if (toast) toast.remove();
        ultimaTarefaExcluida = null;
    }
};

function mostrarToastDesfazer() {
    const existente = document.getElementById("toast-undo");
    if (existente) existente.remove();
    clearTimeout(timeoutDesfazer);

    const toast = document.createElement("div");
    toast.id = "toast-undo";
    toast.innerHTML = `
        <span>Tarefa removida</span>
        <button onclick="window.desfazerExclusao()">Desfazer</button>
    `;
    document.body.appendChild(toast);

    timeoutDesfazer = setTimeout(() => {
        if (toast.parentNode) toast.remove();
        ultimaTarefaExcluida = null;
    }, 5000);
}

// --- CONFIGURAÇÃO POMODORO ---
let timerInterval;
let tarefaAtivaId = null;

// --- GESTÃO DE TAREFAS ---

function criarCartao(texto, id, colunaId) {
    const cartao = document.createElement("div");
    cartao.classList.add("cartao");
    cartao.id = id;

    // Botão Excluir
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
        salvarTarefas();
        mostrarToastDesfazer();
    });

    // Edição
    cartao.addEventListener("dblclick", () => {
        const span = cartao.querySelector("span");
        const novoTexto = prompt("Editar tarefa:", span.textContent);
        if (novoTexto) {
            span.textContent = novoTexto.trim();
            salvarTarefas();
        }
    });

    const spanTexto = document.createElement("span");
    spanTexto.textContent = texto;

    const emoji = document.createElement("span");
    emoji.classList.add("emoji-label");
    const icon = document.createElement("i");
    icon.classList.add("fa-solid");
    
    if (colunaId === "todo") icon.classList.add("fa-clipboard-list");
    if (colunaId === "doing") icon.classList.add("fa-spinner");
    if (colunaId === "done") icon.classList.add("fa-circle-check");
    emoji.appendChild(icon);

    cartao.appendChild(spanTexto);
    cartao.appendChild(emoji);
    cartao.appendChild(btnExcluir);

    // Drag and Drop Events
    cartao.setAttribute("draggable", true);
    cartao.addEventListener("dragstart", () => cartao.classList.add("arrastando"));
    cartao.addEventListener("dragend", () => {
        cartao.classList.remove("arrastando");
        salvarTarefas();
    });

    // Evento para abrir o Pomodoro ao clicar
    cartao.addEventListener("click", () => {
        // O temporizador só deve ativar se a tarefa estiver "Em Progresso"
        if (cartao.parentElement && cartao.parentElement.id === "doing") {
            abrirPomodoro(id, texto);
        }
    });

    return cartao;
}

document.getElementById("adicionar").addEventListener("click", () => {
    const titulo = document.getElementById("titulo").value.trim();
    const colunaDestino = document.getElementById("colunaDestino").value;
    const prioridade = document.getElementById("prioridade").value;

    if (titulo !== "") {
        const novoCartao = criarCartao(titulo, "c" + Date.now(), colunaDestino);
        novoCartao.classList.add(prioridade);
        document.getElementById(colunaDestino).appendChild(novoCartao);
        document.getElementById("titulo").value = "";
        salvarTarefas();
        ordenarColuna(colunaDestino);
    }
});

// --- PERSISTÊNCIA E ORDENAÇÃO ---

function salvarTarefas() {
    const dados = { todo: [], doing: [], done: [] };
    ["todo", "doing", "done"].forEach(coluna => {
        document.querySelectorAll(`#${coluna} .cartao`).forEach(c => {
            dados[coluna].push({
                texto: c.querySelector("span").textContent,
                prioridade: c.classList.contains('alta') ? 'alta' : c.classList.contains('media') ? 'media' : 'baixa'
            });
        });
    });
    localStorage.setItem(getChaveMes(), JSON.stringify(dados));
}

function carregarTarefas() {
    const dados = JSON.parse(localStorage.getItem(getChaveMes()));
    
    ["todo", "doing", "done"].forEach(id => {
        const col = document.getElementById(id);
        const titulo = col.querySelector("h2").outerHTML;
        col.innerHTML = titulo;
    });

    if (!dados) return;

    Object.keys(dados).forEach(colunaId => {
        dados[colunaId].forEach(item => {
            const cartao = criarCartao(item.texto, "c" + Math.random(), colunaId);
            cartao.classList.add(item.prioridade);
            document.getElementById(colunaId).appendChild(cartao);
        });
        ordenarColuna(colunaId);
    });
}

function ordenarColuna(colunaId) {
    const coluna = document.getElementById(colunaId);
    const cartoes = Array.from(coluna.querySelectorAll(".cartao"));
    const ordem = { alta: 1, media: 2, baixa: 3 };

    cartoes.sort((a, b) => {
        const pA = a.classList.contains('alta') ? 'alta' : a.classList.contains('media') ? 'media' : 'baixa';
        const pB = b.classList.contains('alta') ? 'alta' : b.classList.contains('media') ? 'media' : 'baixa';
        return ordem[pA] - ordem[pB];
    });

    cartoes.forEach(c => coluna.appendChild(c));
}

// --- DRAG AND DROP COLUNAS ---

["todo", "doing", "done"].forEach(colunaId => {
    const coluna = document.getElementById(colunaId);

    coluna.addEventListener("dragover", e => {
        e.preventDefault();
        const arrastando = document.querySelector(".arrastando");
        const afterElement = getDragAfterElement(coluna, e.clientY);
        if (afterElement == null) {
            coluna.appendChild(arrastando);
        } else {
            coluna.insertBefore(arrastando, afterElement);
        }
    });

    coluna.addEventListener("drop", () => {
        const arrastando = document.querySelector(".arrastando");
        if (arrastando) {
            const emoji = arrastando.querySelector(".emoji-label");
            const icon = emoji.querySelector("i");
            icon.className = "fa-solid";
            if (colunaId === "todo") icon.classList.add("fa-clipboard-list");
            if (colunaId === "doing") icon.classList.add("fa-spinner");
            if (colunaId === "done") icon.classList.add("fa-circle-check");
            
            salvarTarefas();
            ordenarColuna(colunaId);
        }
    });
});

function getDragAfterElement(container, y) {
    const elementos = [...container.querySelectorAll(".cartao:not(.arrastando)")];
    return elementos.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// --- RELATÓRIO E LIMPEZA ---

const modal = document.getElementById("modal");
document.getElementById("limpar").onclick = () => modal.style.display = "flex";
document.getElementById("cancelar").onclick = () => modal.style.display = "none";
document.getElementById("confirmar").onclick = () => {
    localStorage.removeItem(getChaveMes());
    resetarTelaECarregar();
    modal.style.display = "none";
};

document.getElementById("abrir-relatorio").addEventListener("click", () => {
    gerarRelatorio();
    document.getElementById("modal-relatorio").style.display = "flex";
});

document.getElementById("fechar-relatorio").onclick = () => {
    document.getElementById("modal-relatorio").style.display = "none";
};

function gerarRelatorio() {
    const dados = JSON.parse(localStorage.getItem(getChaveMes())) || { todo: [], doing: [], done: [] };
    const container = document.getElementById("conteudo-relatorio");

    const total = dados.todo.length + dados.doing.length + dados.done.length;
    const concluidas = dados.done.length;
    const taxa = total > 0 ? Math.round((concluidas / total) * 100) : 0;

    const todas = [...dados.todo, ...dados.doing, ...dados.done];
    const prio = {
        alta: todas.filter(t => t.prioridade === 'alta').length,
        media: todas.filter(t => t.prioridade === 'media').length,
        baixa: todas.filter(t => t.prioridade === 'baixa').length
    };

    container.innerHTML = `
        <p>Estatísticas de <b>${document.getElementById("mes-display").textContent}</b></p>
        <div class="relatorio-grid">
            <div class="relatorio-item">Total: <b>${total}</b></div>
            <div class="relatorio-item">Progresso: <b>${taxa}%</b></div>
            <div class="relatorio-item">🔴 Alta: <b>${prio.alta}</b></div>
            <div class="relatorio-item">🟢 Baixa: <b>${prio.baixa}</b></div>
        </div>
    `;
}

// --- INICIALIZAÇÃO ---
// --- INICIALIZAÇÃO INTELIGENTE ---
function inicializarComParametros() {
    const urlParams = new URLSearchParams(window.location.search);
    const mesUrl = urlParams.get('mes');
    const anoUrl = urlParams.get('ano');

    if (mesUrl !== null && anoUrl !== null) {
        // Define a data exibida com base na URL
        dataExibida.setFullYear(parseInt(anoUrl));
        dataExibida.setMonth(parseInt(mesUrl));
    }
    
    resetarTelaECarregar();
}

// Chame a nova inicialização em vez da antiga
inicializarComParametros();

// --- LÓGICA DO POMODORO ---

function abrirPomodoro(id, titulo) {
    tarefaAtivaId = id;
    document.getElementById("pomo-tarefa-titulo").textContent = `Foco: ${titulo}`;
    document.getElementById("pomodoro-container").style.display = "block";
    
    // Resetar o display ao abrir
    const minutosPadrao = document.getElementById("pomo-minutos").value;
    document.getElementById("tempo-restante").textContent = `${minutosPadrao.toString().padStart(2, '0')}:00`;
}

// Fechar o widget
document.getElementById("fechar-pomo")?.addEventListener("click", () => {
    document.getElementById("pomodoro-container").style.display = "none";
    clearInterval(timerInterval);
});

// Iniciar o Cronômetro
document.getElementById("pomo-start")?.addEventListener("click", () => {
    const btn = document.getElementById("pomo-start");
    let minutos = parseInt(document.getElementById("pomo-minutos").value);
    
    if (btn.innerHTML.includes("Iniciar")) {
        btn.innerHTML = '<i class="fa-solid fa-pause"></i> Parar';
        iniciarTimer(minutos);
    } else {
        btn.innerHTML = '<i class="fa-solid fa-play"></i> Iniciar';
        clearInterval(timerInterval);
    }
});

function iniciarTimer(minutos) {
    clearInterval(timerInterval);
    let tempo = minutos * 60;
    const display = document.getElementById("tempo-restante");

    timerInterval = setInterval(() => {
        let mins = Math.floor(tempo / 60);
        let secs = tempo % 60;
        display.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

        if (tempo <= 0) {
            clearInterval(timerInterval);
            alert("⏰ Tempo finalizado! Hora de uma pausa para o Ateliê Márcio Torres.");
            salvarHistoricoPomo(tarefaAtivaId, minutos);
            document.getElementById("pomo-start").innerHTML = '<i class="fa-solid fa-play"></i> Iniciar';
        }
        tempo--;
    }, 1000);
}

function salvarHistoricoPomo(idTarefa, minutos) {
    const chave = `pomo_history_${getChaveMes()}`;
    let historico = JSON.parse(localStorage.getItem(chave)) || [];
    historico.push({ 
        id: idTarefa, 
        data: new Date().toISOString(), 
        tempo: minutos 
    });
    localStorage.setItem(chave, JSON.stringify(historico));
}