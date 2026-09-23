# Diagnóstico da base financeira e operacional — UNIVC

Data da análise: 23/09/2026.

Fonte: **Controle Financeiro - UNIVC - Atualização Parcial 2026.xlsx**. Arquivo original preservado.

## 1. Conclusão

A planilha contém um histórico útil de recebimentos e pagamentos, classificações por curso/centro de resultado, contas de despesas e regras de rateio. É suficiente para iniciar a organização de um modelo de caixa histórico e análises de composição, mas os painéis de margem, EBITDA, inadimplência e saldo acumulado não devem ser utilizados como resultados validados. A cobertura de receitas termina em setembro de 2025 e a de pagamentos em abril de 2026. O nome do arquivo e sua atualização em setembro de 2026 não significam que existam dados completos até essa data.

A base denominada “Recebíveis” contém recebimentos realizados, inclusive lançamentos de valor zero. Não equivale a uma carteira de títulos em aberto.

## 2. Método e limites

Leitura integral das células armazenadas nas 17 abas, incluindo as ocultas, fórmulas presentes no XML, resultados salvos pelo Excel, nomes definidos, tabelas estruturadas, fontes de tabelas dinâmicas e instruções internas. Agregações das três bases principais foram refeitas independentemente em Python. Não houve edição, recálculo no Excel, atualização de tabelas dinâmicas ou validação bancária/contábil. Erros aqui quantificados são os resultados de erro salvos no arquivo; compatibilidade e recálculo podem alterar parte deles. Fórmulas compartilhadas existem: a contagem inclui todas as células de fórmula, mesmo quando o texto é armazenado apenas na célula de origem.

Totais monetários foram apurados com a precisão original e arredondados apenas na apresentação. Alguns rateios têm três casas decimais. Contagens de linhas não são contagens de documentos, alunos ativos ou transações bancárias independentes. Candidatos a duplicidade foram identificados por igualdade de campos, sem exclusão de registros.

## 3. Inventário

17 abas, sendo 5 ocultas; 29 tabelas estruturadas; 6 tabelas dinâmicas; 4 gráficos; 267 nomes definidos, dos quais 102 contêm #REF!. Foram encontradas 2.531.193 células de fórmula e 336.880 resultados de erro salvos. Não foram encontrados componentes VBA, conexões externas ou partes externalLinks no pacote XLSX.


| Aba | Visibilidade | Dimensão declarada | Fórmulas | Erros salvos | Função |
| --- | --- | --- | --- | --- | --- |
| FCX_Consolidado | visible | A1:CB290 | 11.735 | 687 | Fluxo de caixa e composição das contas |
| base_gráfico | hidden | B1:G15 | 2 | 0 | Apoio ao gráfico do fluxo |
| FCX_GRÁFICO | hidden | B15:S26 | 3 | 0 | Painel gráfico do fluxo |
| Abertura_Outros Gastos | visible | A1:G1048 | 0 | 0 | Abertura de fornecedores e despesas |
| Painel_Receita | visible | A1:X54 | 50 | 0 | Painel de recebimentos |
| Registros | visible | A1:XFC195627 | 1.565.637 | 195.621 | Consolidação das entradas e saídas |
| Base_Gastos | visible | A1:V140677 | 8.956 | 3 | Pagamentos, classificações e rateios |
| Painel Gastos | visible | A1:Y136551 | 819.266 | 136.545 | Ranking de gastos e fornecedores |
| INFOS | visible | A3:J27 | 0 | 0 | Resumos de recebimentos por modalidade e meio |
| Cálculos | hidden | B2:Q16 | 21 | 7 | Apoio a cálculos e orçamento |
| Base_Recebíveis | visible | A1:U54955 | 121.150 | 0 | Recebimentos por aluno, curso e modalidade |
| M.C_Técnicos | visible | A1:Y502 | 2.073 | 2.001 | Margem dos cursos técnicos |
| M.C_Mestrado | visible | A1:Y502 | 2.033 | 1.998 | Margem dos mestrados |
| Instruções | hidden | A1:AA192 | 1 | 0 | Glossário e orientações de preenchimento |
| Cadastro | hidden | A1:K2926 | 2 | 0 | Cadastro de clientes e fornecedores |
| M.C_Graduação | visible | A1:Y235 | 264 | 18 | Margem da graduação |
| INSTRUÇÃO | visible | B3:B47 | 0 | 0 | Procedimento mensal de atualização |


A dimensão declarada inclui formatação e áreas auxiliares: Registros chega à coluna XFC e armazena cadastros auxiliares a partir da linha 20.000. Painel Gastos se estende até a linha 136.551 apesar do título “TOP 70”. Isso ajuda a explicar o peso do arquivo, de 60.929.785 bytes.

## 4. Bases disponíveis e dicionário de dados


### Registros

195.619 linhas com valor numérico. Período das datas de liquidação: 01/10/2023 a 30/04/2026. Coluna financeira analisada: M.

| Coluna | Campo |
| --- | --- |
| B | Data Registro |
| C | Data Venc. |
| D | Tipo |
| E | No NF / Recibo |
| F | Data Pagto / Receb. |
| G | Cliente / Fornecedor |
| H | Operação |
| I | Negócios |
| J | Centro de Custo |
| K | Grupo de Conta |
| L | Conta |
| M | Valor |
| N | Observações |
| O | Mês |
| P | Ano |
| Q | Mês-Ano |
| R | Chave_01 |
| S | Oculto |
| T | ID Chave |
| U | Tipo_01 |
| V | Grupo_chave |
| W | Código CC |


### Base_Gastos

140.671 linhas com valor numérico. Período das datas de liquidação: 02/10/2023 a 30/04/2026. Coluna financeira analisada: O.

| Coluna | Campo |
| --- | --- |
| B | NEGÓCIOS |
| C | CENTRO RESULTADO - ORIGEM |
| D | FORNECEDOR |
| E | GRUPO DE DESPESAS |
| F | CATEGORIA DESPESA |
| G | DESCRIÇÃO |
| H | DATA VENCIMENTO |
| I | MÊS |
| J | ANO |
| K | SITUAÇÃO - DESCRIÇÃO |
| L | DATA PAGAMENTO |
| M | VALOR PAGO |
| N | VALOR PAGO_1 |
| O | VALOR PAGO_2 |
| P | Chave_1 |


### Base_Recebíveis

54.948 linhas com valor numérico. Período das datas de liquidação: 01/10/2023 a 30/09/2025. Coluna financeira analisada: H.

| Coluna | Campo |
| --- | --- |
| B | UNIDADE |
| C | CURSO |
| D | Matrícula |
| E | Nome Aluno |
| F | Data Recebimento |
| G | Forma Recebimento |
| H | Valor |
| I | ANO |
| J | MÊS |
| K | Mês-Ano |


**Registros:** valores positivos tanto nas entradas quanto nas saídas. O sinal econômico deve vir da coluna Tipo. Somar simplesmente a coluna M mistura entradas e saídas e não calcula resultado. As 195.619 linhas equivalem numericamente às 140.671 linhas de gastos mais 54.948 de recebimentos. Número de NF/recibo, Operação e Código CC estão vazios em todas as linhas financeiras. Cliente/Fornecedor está vazio em 5.929 linhas. Em 195.466 linhas, as três datas são idênticas; o procedimento interno orienta copiar a data de liquidação também para registro e vencimento. Consequentemente, essas datas não sustentam análise confiável de competência ou atraso.

**Base_Gastos:** a coluna O é a medida usada na consolidação. M e N estão vazias em 136.303 das 140.671 linhas. Não somar M, N e O como gastos diferentes. Todas as linhas financeiras estão marcadas como “Pago”. Há 210 descrições distintas de centro de resultado e 191 descrições de categoria, antes de padronização. A base contém valores já distribuídos entre centros e regras de rateio; não presumir que cada linha corresponde a um título único.

**Base_Recebíveis:** há 109 descrições de curso antes de padronização e 28 descrições de forma de recebimento, algumas combinadas. São 4.729 matrículas distintas após retirar espaços externos; esse número representa identificadores observados no histórico, não alunos ativos no momento. Há 8.655 lançamentos de valor zero. Existem 784 linhas sem matrícula e nome, somando R$ 5.476.077,10, associadas aos valores não conciliados. A soma por modalidade de matrículas pode superar o total único, pois um mesmo identificador pode aparecer em mais de uma modalidade.

## 5. Conciliação dos totais


| Medida | Base de origem (R$) | Registros / fluxo (R$) | Conclusão |
| --- | --- | --- | --- |
| Recebimentos | 40.095.787,06 | 40.095.787,06 | Concilia no total |
| Pagamentos | 52.516.743,60 | 52.516.743,61 | Concilia no total |
| Entradas menos saídas | — | -12.420.956,55 | Coberturas diferentes; não é perda apurada de período completo |


Localizadores: Base_Recebíveis!H8:H54955; Base_Gastos!O7:O140677; Registros!D9:M195627; FCX_Consolidado!AT9:AT11. A conciliação é de soma, não prova correspondência individual ou ausência de duplicidades.

### Períodos com recebimentos e pagamentos presentes

Valores abaixo recompostos pelas datas das bases de origem. “Resultado” significa somente recebimentos menos pagamentos registrados, sem equivaler a lucro ou EBITDA. A presença de dados nos meses não comprova completude contra extratos.


| Período | Recebimentos R$ | Pagamentos R$ | Diferença R$ | Diferença / recebimentos |
| --- | --- | --- | --- | --- |
| Out–dez/2023 | 4.577.089,07 | 5.791.845,39 | -1.214.756,32 | -26,54% |
| Jan–dez/2024 | 19.747.373,97 | 19.429.056,45 | 318.317,52 | 1,61% |
| Jan–set/2025 | 15.771.324,02 | 15.508.913,62 | 262.410,40 | 1,66% |


### Série mensal das bases de origem

“Sem dados” não foi convertido em zero de receita.

| Mês | Recebimentos R$ | Pagamentos R$ | Diferença R$ |
| --- | --- | --- | --- |
| 2023-10 | 1.385.284,49 | 1.577.666,27 | -192.381,78 |
| 2023-11 | 1.433.109,29 | 1.792.175,96 | -359.066,67 |
| 2023-12 | 1.758.695,29 | 2.422.003,16 | -663.307,87 |
| 2024-01 | 2.072.596,22 | 1.672.707,05 | 399.889,17 |
| 2024-02 | 1.217.925,95 | 1.008.597,94 | 209.328,01 |
| 2024-03 | 1.412.029,47 | 1.396.988,59 | 15.040,88 |
| 2024-04 | 2.102.228,90 | 1.553.494,69 | 548.734,21 |
| 2024-05 | 1.263.459,30 | 1.623.901,54 | -360.442,24 |
| 2024-06 | 1.788.046,43 | 1.506.842,13 | 281.204,30 |
| 2024-07 | 1.905.288,26 | 1.527.470,67 | 377.817,59 |
| 2024-08 | 1.154.590,73 | 1.620.282,31 | -465.691,58 |
| 2024-09 | 1.470.936,13 | 1.777.775,36 | -306.839,23 |
| 2024-10 | 1.557.425,88 | 1.545.361,88 | 12.064,00 |
| 2024-11 | 1.334.591,80 | 1.732.473,47 | -397.881,67 |
| 2024-12 | 2.468.254,90 | 2.463.160,81 | 5.094,09 |
| 2025-01 | 1.509.222,06 | 1.571.067,44 | -61.845,38 |
| 2025-02 | 1.534.828,97 | 1.104.334,67 | 430.494,30 |
| 2025-03 | 1.453.996,29 | 1.480.090,86 | -26.094,57 |
| 2025-04 | 1.792.595,42 | 3.542.896,06 | -1.750.300,64 |
| 2025-05 | 1.623.268,62 | 1.444.573,67 | 178.694,95 |
| 2025-06 | 2.433.199,78 | 1.631.901,09 | 801.298,69 |
| 2025-07 | 1.919.990,41 | 1.360.250,86 | 559.739,55 |
| 2025-08 | 1.357.856,02 | 1.879.777,95 | -521.921,93 |
| 2025-09 | 2.146.366,45 | 1.494.021,02 | 652.345,43 |
| 2025-10 | Sem dados | 1.662.031,20 | Não apurável |
| 2025-11 | Sem dados | 1.773.313,74 | Não apurável |
| 2025-12 | Sem dados | 2.400.455,25 | Não apurável |
| 2026-01 | Sem dados | 1.600.784,04 | Não apurável |
| 2026-02 | Sem dados | 1.378.659,71 | Não apurável |
| 2026-03 | Sem dados | 1.564.159,41 | Não apurável |
| 2026-04 | Sem dados | 1.407.524,80 | Não apurável |


### Divergências de mês entre Base_Gastos e Registros

| Mês | Saídas em Registros menos Base_Gastos (R$) |
| --- | --- |
| 2023-12 | -5.000,00 |
| 2024-01 | 5.000,00 |
| 2024-08 | 1.767,92 |
| 2024-09 | -4.492,52 |
| 2024-10 | 2.724,60 |


As diferenças se compensam no total histórico, mas afetam comparações mensais e anuais. Em 2024, por exemplo, o fluxo mostra diferença positiva de R$ 313.317,53, enquanto as bases por data de liquidação produzem R$ 318.317,53.

## 6. Composição dos recebimentos

Período: outubro de 2023 a setembro de 2025. Modalidades normalizadas apenas por caixa de texto.


| Modalidade | Recebimentos R$ | Participação |
| --- | --- | --- |
| GRADUAÇÃO | 23.830.091,28 | 59,43% |
| MESTRADO | 9.055.111,78 | 22,58% |
| FIES NÃO CONCILIADO | 4.890.539,40 | 12,20% |
| TÉCNICOS | 591.826,39 | 1,48% |
| NÃO CONCILIADO | 585.537,70 | 1,46% |
| TÉCNICOS EAD | 493.372,03 | 1,23% |
| GRADUAÇÃO EAD | 394.283,49 | 0,98% |
| PARCEIROS | 160.336,30 | 0,40% |
| PG | 81.812,77 | 0,20% |
| LIVRES | 9.119,20 | 0,02% |
| PARCEIROS PG | 3.756,72 | 0,01% |


Os R$ 4.890.539,40 de FIES não conciliado e R$ 585.537,70 de outros não conciliados totalizam R$ 5.476.077,10, ou 13,66% dos recebimentos. São valores recebidos ainda sem atribuição adequada; não representam, por si, inadimplência. Fonte: Base_Recebíveis!B8:H54955; resumo existente em INFOS!A4:B15.

### Principais cursos ou classificações de receita

| Curso/classificação | Recebimentos R$ |
| --- | --- |
| Ciência, Tecnologia e Educação | 8.977.754,10 |
| Direito | 5.212.586,26 |
| FIES Não Conciliado | 4.890.539,40 |
| Odontologia | 3.201.989,26 |
| Enfermagem | 2.943.051,69 |
| Fisioterapia | 2.760.245,91 |
| Psicologia | 1.726.861,05 |
| Educação Física | 1.012.341,79 |
| Análise e Desenvolvimento de Sistemas | 988.665,55 |
| Medicina Veterinária | 944.745,44 |
| Arquitetura e Urbanismo | 790.135,39 |
| Ciências Contábeis | 687.618,27 |
| Farmácia | 678.838,93 |
| Administração | 637.449,24 |
| Engenharia Mecânica | 636.424,08 |
| NÃO CONCILIADO | 585.537,70 |
| Engenharia de Produção | 545.109,31 |
| Técnico em Enfermagem | 366.327,08 |
| Técnico em Radiologia EAD | 352.753,68 |
| Comunicação Social - Publicidade e Propaganda | 303.219,24 |


### Formas de recebimento com maior volume

| Forma | Valor R$ | Participação |
| --- | --- | --- |
| BOLETO | 19.362.934,49 | 48,29% |
| DEPÓSITO EM CONTA CORRENTE | 10.319.467,63 | 25,74% |
| PIX | 4.751.129,09 | 11,85% |
| CARTÃO DE CRÉDITO | 1.945.307,84 | 4,85% |
| CRÉDITO EM CONTA CORRENTE | 1.690.123,28 | 4,22% |
| DINHEIRO | 1.080.536,82 | 2,69% |
| CARTÃO DE DÉBITO | 476.634,30 | 1,19% |
| DINHEIRO, PIX | 198.172,66 | 0,49% |
| CHEQUE À PRAZO | 135.463,54 | 0,34% |
| CARTÃO DE DÉBITO, DINHEIRO | 71.877,40 | 0,18% |


Não decompor automaticamente descrições como “DINHEIRO, PIX”: a planilha não fornece o valor separado de cada meio.

## 7. Composição dos pagamentos

Período: outubro de 2023 a abril de 2026. Classificação da Base_Gastos, sem reclassificação contábil.

| Grupo de despesas | Pagamentos R$ | Participação |
| --- | --- | --- |
| Gastos com Pessoal | 32.456.555,28 | 61,80% |
| Serviços e Manutenções | 13.690.912,37 | 26,07% |
| Gastos Gerais | 1.793.148,98 | 3,41% |
| Despesa Não Operacional | 1.534.444,15 | 2,92% |
| Material | 1.482.394,89 | 2,82% |
| Despesa Financeira | 769.244,89 | 1,46% |
| Tributos e Impostos | 628.716,41 | 1,20% |
| Investimentos | 158.209,06 | 0,30% |
| Despesas Comerciais | 3.117,57 | 0,01% |


### Principais categorias

| Categoria | Pagamentos R$ |
| --- | --- |
| FOLHA DE PAGAMENTO | 13.837.185,08 |
| INSS - IRRF - PIS | 5.744.641,09 |
| Ticket Alimentação | 2.995.371,65 |
| Consultoria | 2.724.681,20 |
| HONORÁRIOS ADVOCATÍCIOS | 2.251.393,74 |
| Distribuição Antecipada de Lucros | 2.148.687,18 |
| SERVIÇOS PRESTADOS | 1.584.128,23 |
| ASSISTÊNCIA EM INFORMÁTICA | 1.459.422,23 |
| FGTS | 1.422.916,18 |
| INSS | 1.165.579,53 |
| Manutenção e Conservação de Bens | 1.106.383,36 |
| ASSESSORIA JURIDICA | 1.105.567,72 |
| DIVULGAÇÃO E PROPAGANDA | 1.003.130,14 |
| SALÁRIO | 852.313,74 |
| Energia Elétrica | 835.255,57 |
| PARCELAMENTO | 834.867,18 |
| Décimo Terceiro Salário | 703.165,71 |
| Suporte em TI | 666.272,67 |
| Bibliotecas | 640.559,66 |
| ISS | 583.913,24 |
| SERVIÇOS PRESTADOS - ORIENTAÇÃO - DEFESA DE BANCA DE MESTRADO | 566.700,00 |
| SERVIÇOS PRESTADOS - AULA DE MESTRADO | 471.221,28 |
| Rescisão de Contrato de Trabalho | 436.929,05 |
| Depósito Judicial | 430.533,40 |
| Plano de Saude | 404.511,07 |


### Principais favorecidos ou rótulos de pagamento

Alguns nomes são agrupadores, como “FOLHA DE PAGAMENTO”, e não fornecedores individuais.

| Favorecido/rótulo | Pagamentos R$ |
| --- | --- |
| FOLHA DE PAGAMENTO | 14.548.753,48 |
| SECRETARIA DA RECEITA FEDERAL DO BRASIL | 7.933.983,38 |
| COMPROCARD LTDA | 2.985.938,90 |
| FGTS | 1.812.279,74 |
| BORGHI DE AVELOIS SOCIEDADE INDIVIDUAL DE ADVOCACIA | 1.560.000,00 |
| SOLIMAR ROBERTO RIVA | 1.535.462,40 |
| HUB DO CRICARE - TECNOLOGIA E SERVIÇOS LTDA | 1.492.535,82 |
| MARCUS ANTONIUS DA COSTA NUNES | 1.377.743,13 |
| CENTRO DE ESTUDOS E PESQUISAS SAPE DO NORTE | 1.133.300,79 |
| AVELOIS & CABRAL ADVOGADOS ASSOCIADOS | 801.600,00 |
| PREFEITURA MUNICIPAL DE SÃO MATEUS | 693.570,86 |
| GABRIEL VICENTE RIVA SOCIEDADE INDIVIDUAL DE ADVOC | 510.210,82 |
| BC COMERCIALIZADORA DE ENERGIA LTDA | 410.692,20 |
| JOSE FERNANDES MAGNAGO DE JESUS | 410.397,15 |
| GRUPO A EDUCAÇÃO S.A | 370.596,59 |
| Banestes S.A. | 369.832,07 |
| TRIBUNAL REGIONAL DO TRABALHO DA 17ª REGIÃO - ES | 363.485,05 |
| MINHA BIBLIOTECA LTDA | 348.084,00 |
| SALUME ADVOGADOS | 303.096,35 |
| SAMP ESPIRITO SANTO ASSISTENCIA MEDICA LTDA | 263.475,36 |


### Regras de destinação presentes

| Chave de rateio | Valor associado R$ |
| --- | --- |
| Não Ratear | 33.344.369,76 |
| RATEAR TODOS | 16.674.662,08 |
| REMUNERAÇÃO MESTRADO | 1.091.721,28 |
| SOMENTE GRADUAÇÃO | 757.658,14 |
| LABORATÓRIO E CLÍNICA | 517.858,60 |
| SOMENTE MESTRADO | 110.062,19 |
| REMUNERAÇÃO TEC.EAD | 9.790,00 |
| RETEAR TODOS | 4.221,55 |
| NÃO RATEAR | 4.000,00 |
| REMUNERAÇÃO GRAD.EAD | 2.400,00 |


O rótulo “RETEAR TODOS” aparece separado de “RATEAR TODOS” e soma R$ 4.221,55. Essa diferença de grafia pode deixar valores fora de fórmulas por texto exato. “Não Ratear” e “NÃO RATEAR” diferem apenas em caixa e devem receber um único código. As premissas das abas de margem são 90% para graduação, 5% para técnicos e 5% para mestrado, combinadas com proporção de alunos. É necessário confirmar a vigência e a base elegível dessas regras e reconciliar valor antes e depois do rateio.

## 8. Problemas que afetam a confiabilidade

| Prioridade | Evidência e localização | Consequência e tratamento posterior |
| --- | --- | --- |
| Alta | Receitas encerram em set/2025, pagamentos em abr/2026 | Bloquear interpretação de déficit agregado e separar meses sem receita carregada. |
| Alta | FCX_Consolidado!AJ7 = AE15; AN7 = AI15; AO7 = AJ15 | Saldo inicial de ago/2025, dez/2025 e jan/2026 não usa o encerramento imediatamente anterior. Corrigir encadeamento e obter saldo bancário inicial conciliado. |
| Alta | M.C_Graduação!E6:F23 repete os mesmos valores globais; E4 = R$ 88.029.709,20 e F4 = R$ 10.539.678,60 | No estado salvo, os valores não conciliados aparecem 18 vezes. C4 chega a R$ 100.591.697,31. Não utilizar a receita ou o EBITDA dessa aba. |
| Alta | M.C_Graduação!G6:G23 e outras margens exibem 1 por curso, com fórmulas COUNTA/UNIQUE/FILTER | Não são contagens verificadas de alunos. A contagem pode estar mascarando erro de função como um item; confirmar no Excel compatível e reconstruir usando matrícula e período. |
| Alta | Fórmulas de margem, como M.C_Mestrado!C6 e M.C_Graduação!D6, filtram mês sem ano | Misturam o mesmo mês de anos diferentes. Incluir chave ano-mês. O controle de ano presente não garante que seja usado. |
| Alta | M.C_Graduação!O4 = N4/J4 | Percentual chamado EBITDA divide resultado por laboratório/clínica, em vez de receita. Exibe cerca de 371.969,64%. |
| Alta | M.C_Mestrado!L7 é zero, apesar de C7 = 7.590,03 e I7/J7 = zero | A margem dessa linha não segue C menos custos. Há diferença de R$ 7.590,03 frente à regra declarada. |
| Alta | 336.880 células com erro salvo, sobretudo Registros, Painel Gastos e margens | Compatibilidade com funções modernas e fórmulas precisa de revisão; ausência de erro visível em outra célula não valida seu cálculo. |
| Alta | Datas copiadas da liquidação e toda Base_Gastos marcada Pago | Não medir inadimplência, prazo médio de pagamento ou competência a partir desses campos sem fontes originais. |
| Média | Fonte de tabela dinâmica em Base_Gastos!B6:P125775, base até linha 140677 | 14.902 linhas finais ficam fora dessa fonte. Atualização e ampliação são necessárias; outros painéis podem ter filtros próprios. |
| Média | Base_Gastos: autofiltro até linha 110613, dados até 140677 | Filtro não cobre toda a base. |
| Média | Gráfico oculto FCX_GRÁFICO!S17 = R$ 48.166.399,69; fluxo AT10 = R$ 52.516.743,61 em módulo | Diferem R$ 4.350.343,92; investigar filtros e atualização do cache antes de usar o gráfico. |
| Média | Distribuição Antecipada de Lucros incluída em Gastos com Pessoal: R$ 2.148.687,18 | Separar distribuição aos sócios dos custos operacionais ao desenhar DRE e EBITDA. Validar também pró-labore, empréstimos, tributos e investimentos. |
| Média | Grupos do fluxo diferem da classificação da base, embora o total concilie | Pessoal: fluxo 32.458.229,82 vs base 32.456.555,28; Serviços: fluxo 13.604.184,36 vs base 13.690.912,37; Material: fluxo 1.563.220,76 vs base 1.482.394,90. Criar um mapa único de contas. |
| Média | Painel Gastos seleciona 2026 e retorna mensagens de período inválido / #VALUE! | Ranking salvo não representa um relatório utilizável para esse filtro. |
| Média | Títulos de margens referem jun/24, controles mostram outros períodos; M.C_Graduação M1=5, M2=2023 | Títulos devem derivar do período efetivamente calculado. |
| Média | FCX_Consolidado coluna “% Correlação” usa desvio padrão dividido pela média | A fórmula corresponde a uma medida de dispersão relativa, não a uma correlação entre séries. Médias e desvios também usam intervalos e tratamentos de zero diferentes. |

As instruções de atualização confirmam dependência de copiar/colar, ajustar intervalos, classificar por PROCX de períodos anteriores e acrescentar dados de folha. Mencionam expressamente excluir determinados valores de folha dos pagamentos importados para evitar duplicidade, substituindo-os por informações de arquivos de RH. Esses arquivos de suporte não estão na pasta examinada; a prevenção dessa dupla contagem ainda precisa ser conciliada.

### Candidatos a duplicidade


| Base | Repetições com valor não zero | Repetições de valor zero | Soma das repetições não zero R$ |
| --- | --- | --- | --- |
| Registros | 6.697 | 6.361 | 3.329.505,15 |
| Base_Gastos | 5.095 | 0 | 767.714,02 |
| Base_Recebíveis | 1.481 | 6.313 | 2.030.867,81 |


Método: campos B:N em Registros, B:P em Base_Gastos e B:K em Base_Recebíveis, sem normalizar o conteúdo, considerando repetições além da primeira. O resultado depende dos campos escolhidos. Parcelas, pagamentos parciais, rateios e registros repetidos de bolsa podem explicar parte das ocorrências. Esses montantes não são uma estimativa de erro financeiro nem devem ser descontados dos totais sem documento ou identificador de origem. A contagem de Registros não deve ser somada às bases de origem, pois os dados são reproduzidos na consolidação.

## 9. Indicadores possíveis e informações faltantes

| Indicador/análise | Condição atual | Dados ou ajustes necessários |
| --- | --- | --- |
| Recebimentos e pagamentos mensais | Calculável nas bases | Confirmar fechamento por mês e diferenças de transferência. |
| Variação de caixa do período | Calculável com cobertura compatível | Não tratar como saldo bancário ou lucro. |
| Composição de receitas por curso/modalidade/meio | Calculável, com limitações | Padronizar cursos e tratar R$ 5,48 milhões sem conciliação. |
| Participação e concentração dos gastos | Calculável | Unificar classificação, separar favorecidos de agrupadores e revisar rateios. |
| Evolução anual e sazonalidade | Parcial | Comparar mesmos meses; 2023 e 2025 não são anos completos de receitas. |
| Valor médio por recebimento | Calculável como indicador transacional | Definir tratamento de zeros; não chamar de mensalidade média. |
| Recebimento por matrícula identificada | Possível como histórico | Não confundir com ticket de aluno ativo ou receita de competência. |
| Margem por curso | Requer reconstrução | Folha docente, laboratório/clínica, custos diretos, população de alunos e rateios confiáveis. |
| DRE e EBITDA | Não validáveis no modelo atual | Competência, receita faturada, descontos/bolsas, tributos, depreciação e classificação operacional. |
| Inadimplência e aging | Não apuráveis | Títulos emitidos, vencimentos originais, liquidações parciais, saldo aberto, renegociações e data de corte. |
| Prazo médio de recebimento/pagamento | Não apurável de modo confiável | Datas originais de emissão, competência, vencimento e liquidação. |
| Caixa disponível e projeção | Não apuráveis integralmente | Saldos bancários por conta, conciliação, contas a pagar/receber e premissas futuras. |
| Liquidez, endividamento e capital de giro | Não apuráveis | Balanço/balancete, dívida por contrato, disponibilidades e obrigações. |
| Orçado versus realizado | Não disponível | Orçamento mensal por conta e centro, com versões. As referências de orçamento existentes estão quebradas. |
| Evasão, retenção e ocupação | Não disponíveis | Base acadêmica com matrícula ativa, turma, status, ingresso, desligamento e vagas. |
| Ponto de equilíbrio | Não validável | Custos fixos/variáveis, receita líquida, descontos e critério de margem. |

## 10. Direção para a próxima etapa

A estrutura definitiva será construída depois de validar conceitos e fontes. Como ponto de partida, separar arquivos de origem preservados, dados tratados, cadastros/regras, modelo de análise e relatórios de fechamento. Evitar replicar lançamentos manualmente entre bases e Registros.

No modelo, manter tabelas únicas por assunto, com coluna de período, em vez de uma aba por mês. Recebimentos e pagamentos devem ter identificador de origem, arquivo/lote, datas próprias, curso/centro codificado, conta codificada, valor e status. Rateios precisam de tabela separada com critério, vigência e reconciliação com o valor de origem.

Sugestão inicial de conjuntos: (1) Recebimentos; (2) Pagamentos; (3) Títulos em aberto, quando fornecidos; (4) Folha por curso/centro; (5) Alunos por mês; (6) Cursos/centros e plano de contas; (7) Regras de rateio; (8) Calendário e controle de fechamento. Os cálculos alimentarão fluxo de caixa, DRE gerencial e margem por curso conforme a disponibilidade de fontes, com controles de conciliação independentes.

Prioridades: obter recebimentos de out/2025 em diante; completar pagamentos após abr/2026; identificar último mês efetivamente fechado; resolver diferenças de datas; padronizar contas/cursos; conciliar folha e rateios; recuperar matrículas e classificação dos valores não conciliados; então reconstruir indicadores e painéis.

Pontos a definir na próxima conversa: análise por instituição ou também mantenedora/OSCIP; caixa e/ou competência; entidades e contas bancárias incluídas; fontes do sistema acadêmico/financeiro e RH; conceito de aluno ativo; responsabilidade pelo fechamento; regra de alocação do FIES e dos gastos compartilhados. O fato de “OSCIP” figurar como centro de resultado não permite inferir, sozinho, o perímetro jurídico das informações.

## 11. Rastreabilidade e preservação

O arquivo original não foi alterado. Este relatório registra a situação salva e a análise independente das bases. Inventário e extrações de apoio estão na pasta diagnostico para continuidade técnica. Nenhum resultado de margem ou saldo foi corrigido nesta etapa, e nenhum lançamento candidato a duplicidade foi eliminado.
