document.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    const mesUrl = urlParams.get('mes');
    const anoUrl = urlParams.get('ano');

    const hoje = new Date();
    const mes = mesUrl !== null ? parseInt(mesUrl) : hoje.getMonth();
    const ano = anoUrl !== null ? parseInt(anoUrl) : hoje.getFullYear();

    const btnVoltar = document.getElementById('btn-voltar');
    if (btnVoltar && mesUrl !== null && anoUrl !== null) {
        btnVoltar.href = `index.html?mes=${mesUrl}&ano=${anoUrl}`;
    }

    const chaveMes = `kanban_${ano}_${mes}`;
    const chavePomo = `pomo_history_${chaveMes}`; // Chave do histórico de pomodoro
    
    const nomesMeses = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", 
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];

    const tituloDash = document.querySelector("h1");
    if (tituloDash) {
        tituloDash.textContent = `Análise de Desempenho - ${nomesMeses[mes]} / ${ano}`;
    }

    // Recuperar Dados das Tarefas
    const dadosRaw = localStorage.getItem(chaveMes);
    const dados = dadosRaw ? JSON.parse(dadosRaw) : { todo: [], doing: [], done: [] };
    const totalTarefas = [...dados.todo, ...dados.doing, ...dados.done];
    
    // Recuperar Dados do Pomodoro
    const pomoRaw = localStorage.getItem(chavePrio); // Erro de digitação corrigido: deve ser chavePomo
    const historicoPomo = JSON.parse(localStorage.getItem(chavePomo)) || [];
    const totalMinutosFoco = historicoPomo.reduce((acc, curr) => acc + curr.tempo, 0);

    // --- GRÁFICO 1: STATUS ---
    const ctxStatus = document.getElementById('meuGrafico').getContext('2d');
    new Chart(ctxStatus, {
        type: 'bar',
        data: {
            labels: ['A Fazer', 'Em Progresso', 'Concluído'],
            datasets: [{
                label: 'Tarefas',
                data: [dados.todo.length, dados.doing.length, dados.done.length],
                backgroundColor: ['#fef9c3', '#cffafe', '#dcfce7'],
                borderColor: ['#facc15', '#06b6d4', '#22c55e'],
                borderWidth: 2
            }]
        },
        options: { plugins: { legend: { display: false } } }
    });

    // --- GRÁFICO 2: PRIORIDADES ---
    const prioridades = {
        alta: totalTarefas.filter(t => t.prioridade === 'alta').length,
        media: totalTarefas.filter(t => t.prioridade === 'media').length,
        baixa: totalTarefas.filter(t => t.prioridade === 'baixa').length
    };

    const canvasPrio = document.getElementById('graficoPrioridade');
    if (canvasPrio) {
        new Chart(canvasPrio.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Alta', 'Média', 'Baixa'],
                datasets: [{
                    data: [prioridades.alta, prioridades.media, prioridades.baixa],
                    backgroundColor: ['#ef4444', '#facc15', '#22c55e']
                }]
            }
        });
    }

    // --- NOVO: EXIBIR TEMPO DE FOCO ---
    // Vamos injetar um resumo de tempo no HTML dinamicamente
    const grid = document.querySelector(".dashboard-grid");
    const cardFoco = document.createElement("div");
    cardFoco.className = "container-grafico";
    cardFoco.innerHTML = `
        <h3>Tempo de Foco (Pomodoro)</h3>
        <div style="font-size: 3rem; font-weight: bold; color: #4f46e5; margin: 20px 0;">
            ${totalMinutosFoco} <span style="font-size: 1.2rem;">min</span>
        </div>
        <p>Total de sessões finalizadas: <b>${historicoPomo.length}</b></p>
    `;
    grid.appendChild(cardFoco);
});