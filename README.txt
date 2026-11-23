UV–TOG Analyzer Web

1. Abra index.html no navegador ou publique os três arquivos no GitHub Pages.
2. Em "Dados", importe os TXT do GENESYS.
3. Após a importação, informe a concentração em ppm de cada amostra de calibração.
4. Em "Pré-processamento", selecione faixa e método.
5. Opcionalmente execute PCA.
6. Em "PLS", selecione validação e gere o modelo.
7. Salve o modelo em JSON.
8. Em "Prever TOG", importe novas amostras desconhecidas e use o modelo para prever.
9. Exporte resultados em CSV.

Observação: a implementação de derivada Savitzky-Golay usa uma aproximação derivativa simples nesta versão web.
Para publicação científica, valide o pipeline contra um software de referência e use validação externa sempre que possível.
