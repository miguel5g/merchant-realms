/* ============================================================
   Changelog.js — Histórico de versões e alterações do jogo
   Compatível com Node.js (CommonJS) e navegador (root.Game)
   ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Game = root.Game || {};
    Object.assign(root.Game, factory());
  }
})(typeof self !== 'undefined' ? self : this, function () {

  const CHANGELOG = [
    {
      version: 'v0.4.0',
      date: '07 de Setembro de 2026',
      title: 'Controles e Interação com o Mundo',
      current: true,
      items: [
        {
          type: 'melhoria',
          title: 'Inversão dos Botões de Interação',
          desc: 'Botão esquerdo agora coloca itens de construção selecionados na hotbar (muros, baús e bancadas). Botão direito quebra blocos e extrai recursos sob o cursor (árvores, rochas, minérios e construções), independente do item selecionado.'
        },
        {
          type: 'melhoria',
          title: 'Validação Completa de Posicionamento',
          desc: 'Checagem rigorosa de alcance (3 tiles), terreno desobstruído e sobreposição com caixas de colisão de jogadores (evitando prendê-los dentro de estruturas). O consumo de item no inventário ocorre apenas após aprovação de todas as validações.'
        },
        {
          type: 'novo',
          title: 'Painel Fixo de Inspeção de Recursos',
          desc: 'Substituição do tooltip flutuante por um painel elegante fixado abaixo do minimapa, exibindo ícone pixel art, rendimento, tempo de extração, ferramenta recomendada, barra de progresso visual e alertas contextuais limpos.'
        },
        {
          type: 'melhoria',
          title: 'Lista de Fabricação (Craft) Enxuta',
          desc: 'Listagem de receitas simplificada exibindo apenas o nome e quantidade máxima fabricável (×N). Materiais necessários e botões de fabricação agora residem de forma limpa no painel de detalhes dinâmico.'
        },
        {
          type: 'melhoria',
          title: 'Atualização de Instruções e Indicadores Visuais',
          desc: 'Hotbar (#hb-label), janela de controles [Esc], tooltips e documentação atualizados para refletir o novo padrão de botões, com supressão inteligente do realce amarelo quando a mira sobrepõe o jogador.'
        }
      ]
    },
    {
      version: 'v0.3.0',
      date: '07 de Setembro de 2026',
      title: 'Sistema de Perfil, Conquistas e Economia',
      items: [
        {
          type: 'melhoria',
          title: 'Tooltips Simples nos Inventários',
          desc: 'Ao passar o mouse sobre qualquer item nos slots de inventário, atalhos, equipamentos ou trocas, um tooltip claro e limpo exibe o nome do item e sua durabilidade.'
        },
        {
          type: 'novo',
          title: 'Tela de Changelog Integrada',
          desc: 'Adicionada interface para acompanhar todas as notas de atualização do jogo pelo menu ou pressionando [C].'
        },
        {
          type: 'novo',
          title: 'Sistema de Perfil e Conquistas',
          desc: 'Acompanhe seu nível, horas jogadas, recursos minerados, blocos colocados e desbloqueie 11 conquistas com títulos exclusivos.'
        },
        {
          type: 'novo',
          title: 'Reputação Comercial e Parceiros Frequentes',
          desc: 'Registro de trocas concluídas, cancelamentos e índice de confiabilidade entre negociantes.'
        },
        {
          type: 'novo',
          title: 'Customização de Cores do Personagem',
          desc: 'Escolha a cor do seu personagem na paleta disponível diretamente na tela de perfil [P].'
        },
        {
          type: 'melhoria',
          title: 'Regras de Nomes no Multiplayer e Chat Privado',
          desc: 'Restrição de caracteres para nomes de jogadores (2 a 16 caracteres, sem espaços, apenas letras, números, _ ou -), garantindo o funcionamento perfeito do comando de sussurro /w.'
        },
        {
          type: 'melhoria',
          title: 'Minimapa com Marcadores de Jogadores',
          desc: 'O minimapa agora exibe outros jogadores com suas respectivas cores em tempo real.'
        },
        {
          type: 'balanceamento',
          title: 'Recompensa Diária de Moedas',
          desc: 'Cada jogador online recebe 10 coroas a cada novo amanhecer no mundo.'
        }
      ]
    },
    {
      version: 'v0.2.0',
      date: '05 de Setembro de 2026',
      title: 'Multiplayer, Comércio e Fabricação',
      items: [
        {
          type: 'novo',
          title: 'Sistema de Comércio Seguro (P2P)',
          desc: 'Negocie itens e moedas com jogadores próximos (até 5 tiles) com interface de confirmação dupla.'
        },
        {
          type: 'novo',
          title: 'Chat Dividido em Canais',
          desc: 'Comunicação organizada em Global, Local (raio de 20 tiles), Comércio e Sussurro privativo (/w).'
        },
        {
          type: 'novo',
          title: 'Sistema de Perícias (Skills)',
          desc: 'Evolua perícias de Mineração, Lenhador, Construção, Comércio e Exploração conforme joga.'
        },
        {
          type: 'novo',
          title: 'Novos Itens e Construções',
          desc: 'Criação de baús, bancadas de trabalho, muros de pedra e placas metálicas.'
        },
        {
          type: 'melhoria',
          title: 'Ciclo Dia e Noite com Iluminação Dinâmica',
          desc: 'Duração de 10 minutos por dia de jogo, transição suave de iluminação e relógio no HUD.'
        },
        {
          type: 'correcao',
          title: 'Sincronização de Chunks e Posição',
          desc: 'Interpolação de movimento de outros jogadores para eliminar saltos visuais.'
        }
      ]
    },
    {
      version: 'v0.1.0',
      date: '01 de Setembro de 2026',
      title: 'Fundação do Protótipo & Mundo Procedural',
      items: [
        {
          type: 'novo',
          title: 'Geração Procedural com Ruído Perlin',
          desc: 'Mundo infinito dividido em chunks com biomas de água, areia, grama e depósitos de pedra.'
        },
        {
          type: 'novo',
          title: 'Mineração e Coleta de Recursos',
          desc: 'Extração de madeira em árvores e minérios de pedra, ferro e cobre com tempo de extração.'
        },
        {
          type: 'novo',
          title: 'Inventário e Hotbar',
          desc: '32 slots de inventário com 8 slots de acesso rápido (hotbar) e suporte a divisão de pilhas.'
        },
        {
          type: 'novo',
          title: 'Servidor WebSocket e Multi-instância',
          desc: 'Arquitetura Fastify com suporte a múltiplos servidores via lista PEERS e persistência automática.'
        }
      ]
    }
  ];

  return {
    CHANGELOG
  };
});
