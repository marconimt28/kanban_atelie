document.addEventListener("DOMContentLoaded", async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const hoje = new Date();
    const mes = urlParams.get('mes') !== null ? parseInt(urlParams.get('mes')) : hoje.getMonth();
    const ano = urlParams.get('ano') !== null ? parseInt(urlParams.get('ano')) : hoje.getFullYear();

    const chaveMes = `kanban_${ano}_${mes}`;
    const nomesMeses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    
    document.querySelector("h1").textContent = `Análise de Desempenho - ${nomesMeses[mes]} / ${ano}`;
    const btnVoltar = document.getElementById('btn-voltar');
    if (btnVoltar) btnVoltar.href = `index.html?mes=${mes}&ano=${ano}`;

    // --- CARREGAMENTO DE DADOS (LOCAL + FIREBASE) ---
    let dados = JSON.parse(localStorage.getItem(chaveMes)) || { todo: [], doing: [], done: [] };

    // Aguarda um pequeno tempo para garantir que o Firebase injetado no index (se compartilhado) ou se houver script de conexão aqui
    if (window.db) {
        try {
            const snap = await window.fsMethods.getDoc(window.fsMethods.doc(window.db, "meses", chaveMes));
            if (snap.exists()) dados = snap.data();
        } catch (e) { console.warn("Firebase offline no Dashboard, usando LocalStorage."); }
    }

    const totalTarefas = [...dados.todo, ...dados.doing, ...dados.done];

    // --- GRÁFICO STATUS ---
    new Chart(document.getElementById('meuGrafico').getContext('2d'), {
        type: 'bar',
        data: {
            labels: ['A Fazer', 'Em Progresso', 'Concluído'],
            datasets: [{
                data: [dados.todo.length, dados.doing.length, dados.done.length],
                backgroundColor: ['#fef9c3', '#cffafe', '#dcfce7'],
                borderColor: ['#facc15', '#06b6d4', '#22c55e'],
                borderWidth: 2
            }]
        },
        options: { plugins: { legend: { display: false } } }
    });

    // --- GRÁFICO PRIORIDADES ---
    const prioCount = {
        alta: totalTarefas.filter(t => t.prioridade === 'alta').length,
        media: totalTarefas.filter(t => t.prioridade === 'media').length,
        baixa: totalTarefas.filter(t => t.prioridade === 'baixa').length
    };

    new Chart(document.getElementById('graficoPrioridade').getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: ['Alta', 'Média', 'Baixa'],
            datasets: [{
                data: [prioCount.alta, prioCount.media, prioCount.baixa],
                backgroundColor: ['#ef4444', '#facc15', '#22c55e']
            }]
        }
    });

    // --- TEMPO DE FOCO ---
    const historicoPomo = JSON.parse(localStorage.getItem(`pomo_history_${chaveMes}`)) || [];
    const totalMinutos = historicoPomo.reduce((acc, curr) => acc + curr.tempo, 0);

    const grid = document.querySelector(".dashboard-grid");
    const cardFoco = document.createElement("div");
    cardFoco.className = "container-grafico";
    cardFoco.innerHTML = `
        <h3>Tempo de Foco (Pomodoro)</h3>
        <div style="font-size: 3rem; font-weight: bold; color: #4f46e5; margin: 20px 0;">
            ${totalMinutos} <span style="font-size: 1.2rem;">min</span>
        </div>
        <p>Sessões finalizadas: <b>${historicoPomo.length}</b></p>
    `;
    grid.appendChild(cardFoco);
});
