import pandas as pd
import seaborn as sns
import matplotlib.pyplot as plt
import numpy as np

# --- 1. Charger le CSV ---
df = pd.read_csv("performance.csv")

# --- 2. Nettoyage rapide ---
df = df.fillna(0)

# Convertir les colonnes de temps et mémoire en float
cols = ["Build Time (ms)", "Match Time (ms)", "Total Time (ms)", "Memory Used (KB)", "Structure Size (KB)"]
for col in cols:
    df[col] = df[col].astype(float)

# --- 3. Style graphique ---
sns.set_style("whitegrid")
plt.rcParams['figure.dpi'] = 100
plt.rcParams['savefig.dpi'] = 300
plt.rcParams['font.size'] = 10

# Palette de couleurs cohérente
algo_colors = {
    'KMP': '#1f77b4',
    'Boyer-Moore': '#ff7f0e', 
    'Aho-Corasick': '#2ca02c',
    'NFA': '#d62728',
    'NFA+DFA-cache': '#9467bd',
    'DFA': '#8c564b',
    'min-DFA': '#e377c2',
}

# ============================================================================
# GRAPHIQUE 1: Comparaison KMP vs Boyer-Moore pour patterns littéraux
# Justifie: "KMP si court (<10 chars), Boyer-Moore sinon"
# ============================================================================
print("Génération du graphique 1: KMP vs Boyer-Moore...")

literal_patterns = df[
    (df['Algorithm'].isin(['KMP', 'Boyer-Moore'])) &
    (df['Scenario'].str.contains('Literal'))
].copy()

# Ajouter une colonne pour la longueur du pattern
pattern_lengths = {
    'abc': 3,
    'the': 3,
    'abcdefghijklmnop': 16,
    'constitution': 12
}
literal_patterns['Pattern Length'] = literal_patterns['Pattern'].map(pattern_lengths)

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))

# Graphique par longueur de pattern
for algo in ['KMP', 'Boyer-Moore']:
    data = literal_patterns[literal_patterns['Algorithm'] == algo]
    grouped = data.groupby('Pattern Length')['Match Time (ms)'].mean().reset_index()
    ax1.plot(grouped['Pattern Length'], grouped['Match Time (ms)'], 
             marker='o', label=algo, linewidth=2, markersize=8,
             color=algo_colors[algo])

ax1.set_xlabel('Longueur du Pattern (caractères)', fontsize=11)
ax1.set_ylabel('Temps de Matching (ms)', fontsize=11)
ax1.set_title('KMP vs Boyer-Moore: Impact de la longueur du pattern', fontsize=12, fontweight='bold')
ax1.legend(fontsize=10)
ax1.grid(True, alpha=0.3)
ax1.axvline(x=10, color='red', linestyle='--', alpha=0.5, linewidth=1.5)
ax1.text(10.5, ax1.get_ylim()[1]*0.9, 'Seuil\n(10 chars)', fontsize=9, color='red')

# Graphique en barres groupées
patterns_to_show = ['abc', 'constitution']
data_subset = literal_patterns[literal_patterns['Pattern'].isin(patterns_to_show)]
x = np.arange(len(patterns_to_show))
width = 0.35

kmp_times = [data_subset[(data_subset['Pattern'] == p) & (data_subset['Algorithm'] == 'KMP')]['Match Time (ms)'].mean() 
             for p in patterns_to_show]
bm_times = [data_subset[(data_subset['Pattern'] == p) & (data_subset['Algorithm'] == 'Boyer-Moore')]['Match Time (ms)'].mean() 
            for p in patterns_to_show]

ax2.bar(x - width/2, kmp_times, width, label='KMP', color=algo_colors['KMP'])
ax2.bar(x + width/2, bm_times, width, label='Boyer-Moore', color=algo_colors['Boyer-Moore'])

ax2.set_xlabel('Pattern', fontsize=11)
ax2.set_ylabel('Temps de Matching (ms)', fontsize=11)
ax2.set_title('Comparaison sur patterns courts vs longs', fontsize=12, fontweight='bold')
ax2.set_xticks(x)
ax2.set_xticklabels([f'{p}\n({pattern_lengths[p]} chars)' for p in patterns_to_show])
ax2.legend(fontsize=10)
ax2.grid(True, alpha=0.3, axis='y')

plt.tight_layout()
plt.savefig('imgs/graph1_kmp_vs_boyermoore.png', bbox_inches='tight')
print("  -> Sauvegardé: imgs/graph1_kmp_vs_boyermoore.png")
plt.close()

# ============================================================================
# GRAPHIQUE 2: Taille de structure NFA vs DFA vs min-DFA
# Justifie: l'intérêt de la minimisation pour réduire la taille
# ============================================================================
print("Génération du graphique 2: Taille des structures...")

structure_data = df[
    (df['Algorithm'].isin(['NFA', 'DFA', 'min-DFA'])) &
    (df['Structure Size (KB)'] > 0) &
    (~df['Scenario'].str.contains('prefilter'))
].copy()

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))

# Graphique 1: Nombre de nœuds
scenarios_to_show = ['Short Literal - Small Text', 'Long Literal - Small Text', 
                     'Simple Regex - Dot', 'Complex Regex - Alternation']
data_nodes = structure_data[structure_data['Scenario'].isin(scenarios_to_show)]

x = np.arange(len(scenarios_to_show))
width = 0.25

for i, algo in enumerate(['NFA', 'DFA', 'min-DFA']):
    nodes = [data_nodes[(data_nodes['Scenario'] == s) & (data_nodes['Algorithm'] == algo)]['Structure Nodes'].mean() 
             for s in scenarios_to_show]
    ax1.bar(x + i*width, nodes, width, label=algo, color=algo_colors[algo])

ax1.set_xlabel('Type de Pattern', fontsize=11)
ax1.set_ylabel('Nombre de Nœuds', fontsize=11)
ax1.set_title('Taille de la structure: Nombre de nœuds', fontsize=12, fontweight='bold')
ax1.set_xticks(x + width)
ax1.set_xticklabels(['Littéral\ncourt', 'Littéral\nlong', 'Regex\nsimple', 'Regex\ncomplexe'], fontsize=9)
ax1.legend(fontsize=10)
ax1.grid(True, alpha=0.3, axis='y')

# Graphique 2: Taille en KB
for i, algo in enumerate(['NFA', 'DFA', 'min-DFA']):
    sizes = [data_nodes[(data_nodes['Scenario'] == s) & (data_nodes['Algorithm'] == algo)]['Structure Size (KB)'].mean() 
             for s in scenarios_to_show]
    ax2.bar(x + i*width, sizes, width, label=algo, color=algo_colors[algo])

ax2.set_xlabel('Type de Pattern', fontsize=11)
ax2.set_ylabel('Taille Mémoire (KB)', fontsize=11)
ax2.set_title('Taille de la structure: Mémoire utilisée', fontsize=12, fontweight='bold')
ax2.set_xticks(x + width)
ax2.set_xticklabels(['Littéral\ncourt', 'Littéral\nlong', 'Regex\nsimple', 'Regex\ncomplexe'], fontsize=9)
ax2.legend(fontsize=10)
ax2.grid(True, alpha=0.3, axis='y')

plt.tight_layout()
plt.savefig('imgs/graph2_structure_size.png', bbox_inches='tight')
print("  -> Sauvegardé: imgs/graph2_structure_size.png")
plt.close()

# ============================================================================
# GRAPHIQUE 3: Impact du préfiltrage selon la TAILLE DU TEXTE
# Justifie: "Préfiltrage désactivé pour petits textes (<10KB)"
# ============================================================================
print("Génération du graphique 3: Impact du préfiltrage selon la taille du texte...")

# Préparer les données pour NFA et DFA séparément
fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(16, 10))

# Pattern à utiliser pour l'analyse
test_pattern = 'a.c'

for idx, (algo_base, axes) in enumerate([('NFA', (ax1, ax2)), ('DFA', (ax3, ax4))]):
    # Comparer avec et sans préfiltrage
    prefilter_data = df[
        (df['Algorithm'].isin([algo_base, f'{algo_base} (with prefilter)'])) &
        (df['Scenario'].str.contains('Regex')) &
        (df['Pattern'] == test_pattern)
    ].copy()

    if len(prefilter_data) == 0:
        continue

    # Créer une colonne pour distinguer avec/sans préfiltrage
    prefilter_data['Has Prefilter'] = prefilter_data['Algorithm'].str.contains('prefilter')
    prefilter_data['Text Size (KB)'] = prefilter_data['Text Length'] / 1024

    # Graphique gauche: Temps total avec et sans préfiltrage
    text_sizes = sorted(prefilter_data['Text Size (KB)'].unique())

    without_prefilter_times = []
    with_prefilter_times = []

    for size in text_sizes:
        data_size = prefilter_data[prefilter_data['Text Size (KB)'] == size]

        without = data_size[~data_size['Has Prefilter']]['Total Time (ms)'].mean()
        with_pf = data_size[data_size['Has Prefilter']]['Total Time (ms)'].mean()

        without_prefilter_times.append(without if not np.isnan(without) else 0)
        with_prefilter_times.append(with_pf if not np.isnan(with_pf) else 0)

    axes[0].plot(text_sizes, without_prefilter_times, marker='o', label='Sans préfiltrage',
                 linewidth=2, markersize=8, color='#1f77b4')
    axes[0].plot(text_sizes, with_prefilter_times, marker='s', label='Avec préfiltrage',
                 linewidth=2, markersize=8, color='#ff7f0e')

    axes[0].set_xlabel('Taille du Texte (KB)', fontsize=11)
    axes[0].set_ylabel('Temps Total (ms)', fontsize=11)
    axes[0].set_title(f'Impact du préfiltrage - {algo_base}\n(Pattern: {test_pattern})',
                      fontsize=12, fontweight='bold')
    axes[0].legend(fontsize=10)
    axes[0].grid(True, alpha=0.3)
    axes[0].set_xscale('log')
    axes[0].axvline(x=10, color='red', linestyle='--', alpha=0.5, linewidth=1.5)

    # Ajouter annotation pour le seuil
    y_pos = axes[0].get_ylim()[1] * 0.85
    axes[0].text(10.5, y_pos, 'Seuil\n(10 KB)', fontsize=9, color='red',
                 bbox=dict(boxstyle='round', facecolor='white', alpha=0.7))

    # Graphique droit: Gain/Perte en pourcentage
    percentages = []
    for i in range(len(text_sizes)):
        if without_prefilter_times[i] > 0:
            # Positif = gain (plus rapide avec préfiltrage)
            # Négatif = perte (plus lent avec préfiltrage)
            pct = (without_prefilter_times[i] - with_prefilter_times[i]) / without_prefilter_times[i] * 100
            percentages.append(pct)
        else:
            percentages.append(0)

    colors_pct = ['green' if p > 0 else 'red' for p in percentages]
    bars = axes[1].bar(range(len(text_sizes)), percentages, color=colors_pct, alpha=0.7)

    axes[1].axhline(y=0, color='black', linestyle='-', linewidth=0.8)
    axes[1].set_xlabel('Taille du Texte (KB)', fontsize=11)
    axes[1].set_ylabel('Gain de Performance (%)', fontsize=11)
    axes[1].set_title(f'Gain/Perte avec préfiltrage - {algo_base}\n(Positif = Gain, Négatif = Perte)',
                      fontsize=12, fontweight='bold')
    axes[1].set_xticks(range(len(text_sizes)))
    axes[1].set_xticklabels([f'{int(s)}' if s < 1000 else f'{int(s/1024)}M' for s in text_sizes],
                            rotation=45, ha='right', fontsize=9)
    axes[1].grid(True, alpha=0.3, axis='y')

    # Ajouter les valeurs sur les barres
    for i, (size, pct) in enumerate(zip(text_sizes, percentages)):
        if abs(pct) > 0.5:  # Afficher seulement si significatif
            axes[1].text(i, pct + (1 if pct > 0 else -1), f'{pct:.1f}%',
                        ha='center', va='bottom' if pct > 0 else 'top', fontsize=8)

    # Marquer la zone < 10KB
    if len(text_sizes) > 0:
        threshold_idx = sum(1 for s in text_sizes if s < 10)
        if threshold_idx > 0:
            axes[1].axvspan(-0.5, threshold_idx - 0.5, alpha=0.1, color='red',
                           label='< 10KB (préfiltrage non recommandé)')
            axes[1].legend(fontsize=9)

plt.tight_layout()
plt.savefig('imgs/graph3_prefilter_impact.png', bbox_inches='tight')
print("  -> Sauvegardé: imgs/graph3_prefilter_impact.png")
plt.close()

# ============================================================================
# GRAPHIQUE 4: NFA vs DFA vs min-DFA vs NFA+DFA-cache selon la taille du texte
# Justifie: "NFA pour très petit (<500B), NFA+DFA-cache pour petit (500B-10KB), DFA/min-DFA sinon"
# ============================================================================
print("Génération du graphique 4: Choix d'algorithme selon la taille du texte...")

# On va simuler différentes tailles de texte en utilisant les scénarios disponibles
automata_data = df[
    (df['Algorithm'].isin(['NFA', 'NFA+DFA-cache', 'DFA', 'min-DFA'])) &
    (~df['Scenario'].str.contains('prefilter'))
].copy()

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))

# Graphique 1: Temps de construction vs temps de matching
for algo in ['NFA', 'NFA+DFA-cache', 'DFA', 'min-DFA']:
    data_algo = automata_data[automata_data['Algorithm'] == algo]
    ax1.scatter(data_algo['Build Time (ms)'], data_algo['Match Time (ms)'], 
               label=algo, s=100, alpha=0.6, color=algo_colors[algo])

ax1.set_xlabel('Temps de Construction (ms)', fontsize=11)
ax1.set_ylabel('Temps de Matching (ms)', fontsize=11)
ax1.set_title('Trade-off: Construction vs Matching', fontsize=12, fontweight='bold')
ax1.legend(fontsize=10)
ax1.grid(True, alpha=0.3)
ax1.set_xscale('log')
ax1.set_yscale('log')

# Graphique 2: Temps total par algorithme pour différents scénarios
scenarios_complexity = ['Short Literal - Small Text', 'Simple Regex - Dot', 'Complex Regex - Alternation']
x = np.arange(len(scenarios_complexity))
width = 0.2

for i, algo in enumerate(['NFA', 'NFA+DFA-cache', 'DFA', 'min-DFA']):
    times = [automata_data[(automata_data['Scenario'] == s) & (automata_data['Algorithm'] == algo)]['Total Time (ms)'].mean() 
             for s in scenarios_complexity]
    ax2.bar(x + i*width, times, width, label=algo, color=algo_colors[algo])

ax2.set_xlabel('Complexité du Pattern', fontsize=11)
ax2.set_ylabel('Temps Total (ms)', fontsize=11)
ax2.set_title('Performance selon la complexité du pattern', fontsize=12, fontweight='bold')
ax2.set_xticks(x + width * 1.5)
ax2.set_xticklabels(['Littéral\nsimple', 'Regex\nsimple', 'Regex\ncomplexe'], fontsize=9)
ax2.legend(fontsize=9)
ax2.grid(True, alpha=0.3, axis='y')
ax2.set_yscale('log')

plt.tight_layout()
plt.savefig('imgs/graph4_automata_comparison.png', bbox_inches='tight')
print("  -> Sauvegardé: imgs/graph4_automata_comparison.png")
plt.close()

# ============================================================================
# GRAPHIQUE 5: Aho-Corasick vs autres pour alternations de littéraux
# Justifie: "Aho-Corasick pour alternations pures de littéraux"
# ============================================================================
print("Génération du graphique 5: Aho-Corasick pour alternations...")

alternation_data = df[
    (df['Scenario'].str.contains('Alternation')) &
    (~df['Scenario'].str.contains('prefilter'))
].copy()

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))

# Graphique 1: Comparaison des temps
algos_to_compare = ['Aho-Corasick', 'NFA', 'NFA+DFA-cache', 'DFA', 'min-DFA']
build_times = []
match_times = []

for algo in algos_to_compare:
    data_algo = alternation_data[alternation_data['Algorithm'] == algo]
    build_times.append(data_algo['Build Time (ms)'].mean())
    match_times.append(data_algo['Match Time (ms)'].mean())

x = np.arange(len(algos_to_compare))
width = 0.35

ax1.bar(x - width/2, build_times, width, label='Construction', color='skyblue')
ax1.bar(x + width/2, match_times, width, label='Matching', color='lightcoral')

ax1.set_xlabel('Algorithme', fontsize=11)
ax1.set_ylabel('Temps (ms)', fontsize=11)
ax1.set_title('Aho-Corasick vs Automates pour alternations', fontsize=12, fontweight='bold')
ax1.set_xticks(x)
ax1.set_xticklabels(algos_to_compare, rotation=15, ha='right', fontsize=9)
ax1.legend(fontsize=10)
ax1.grid(True, alpha=0.3, axis='y')

# Graphique 2: Temps total
total_times = [alternation_data[alternation_data['Algorithm'] == algo]['Total Time (ms)'].mean()
               for algo in algos_to_compare]

colors_bar = [algo_colors.get(algo, 'gray') for algo in algos_to_compare]
bars = ax2.bar(algos_to_compare, total_times, color=colors_bar, alpha=0.7)

# Mettre en évidence Aho-Corasick
bars[0].set_edgecolor('black')
bars[0].set_linewidth(2)

ax2.set_xlabel('Algorithme', fontsize=11)
ax2.set_ylabel('Temps Total (ms)', fontsize=11)
ax2.set_title('Performance globale sur alternations', fontsize=12, fontweight='bold')
ax2.set_xticklabels(algos_to_compare, rotation=15, ha='right', fontsize=9)
ax2.grid(True, alpha=0.3, axis='y')

# Ajouter les valeurs sur les barres
for i, (algo, time) in enumerate(zip(algos_to_compare, total_times)):
    ax2.text(i, time + max(total_times)*0.02, f'{time:.1f}',
             ha='center', va='bottom', fontsize=9)

plt.tight_layout()
plt.savefig('imgs/graph5_aho_corasick.png', bbox_inches='tight')
print("  -> Sauvegardé: imgs/graph5_aho_corasick.png")
plt.close()

# ============================================================================
# GRAPHIQUE 6: Vue d'ensemble - Matrice de décision
# Justifie: la sélection automatique d'algorithme
# ============================================================================
print("Génération du graphique 6: Matrice de décision...")

# Créer une heatmap montrant quel algorithme est le plus rapide pour chaque scénario
scenarios_all = df['Scenario'].unique()
scenarios_all = [s for s in scenarios_all if 'prefilter' not in s]

# Pour chaque scénario, trouver l'algorithme le plus rapide
best_algos = []
for scenario in scenarios_all:
    data_scenario = df[(df['Scenario'] == scenario) & (~df['Algorithm'].str.contains('prefilter'))]
    if len(data_scenario) > 0:
        best_algo = data_scenario.loc[data_scenario['Total Time (ms)'].idxmin(), 'Algorithm']
        best_algos.append(best_algo)
    else:
        best_algos.append('N/A')

# Créer un DataFrame pour la visualisation
decision_df = pd.DataFrame({
    'Scenario': scenarios_all,
    'Best Algorithm': best_algos
})

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 6))

# Graphique 1: Tableau des meilleurs algorithmes
scenario_labels = [s.replace(' - ', '\n') for s in scenarios_all]
colors_map = {algo: algo_colors.get(algo, 'gray') for algo in best_algos}
colors_list = [colors_map[algo] for algo in best_algos]

ax1.barh(range(len(scenarios_all)), [1]*len(scenarios_all), color=colors_list, alpha=0.7)
ax1.set_yticks(range(len(scenarios_all)))
ax1.set_yticklabels(scenario_labels, fontsize=8)
ax1.set_xlim(0, 1)
ax1.set_xticks([])
ax1.set_title('Algorithme optimal par scénario', fontsize=12, fontweight='bold')

# Ajouter les noms des algorithmes sur les barres
for i, algo in enumerate(best_algos):
    ax1.text(0.5, i, algo, ha='center', va='center', fontsize=9, fontweight='bold')

# Graphique 2: Distribution des algorithmes gagnants
from collections import Counter
algo_counts = Counter(best_algos)

algos_sorted = sorted(algo_counts.items(), key=lambda x: x[1], reverse=True)
algos_names = [a[0] for a in algos_sorted]
algos_values = [a[1] for a in algos_sorted]

colors_pie = [algo_colors.get(algo, 'gray') for algo in algos_names]
ax2.pie(algos_values, labels=algos_names, autopct='%1.1f%%', startangle=90,
        colors=colors_pie, textprops={'fontsize': 10})
ax2.set_title('Distribution des algorithmes optimaux', fontsize=12, fontweight='bold')

plt.tight_layout()
plt.savefig('imgs/graph6_decision_matrix.png', bbox_inches='tight')
print("  -> Sauvegardé: imgs/graph6_decision_matrix.png")
plt.close()

print("\n✓ Tous les graphiques ont été générés avec succès!")
print("\nGraphiques générés:")
print("  1. graph1_kmp_vs_boyermoore.png - Justifie le choix KMP vs Boyer-Moore")
print("  2. graph2_structure_size.png - Justifie l'intérêt de la minimisation")
print("  3. graph3_prefilter_impact.png - Justifie quand activer le préfiltrage")
print("  4. graph4_automata_comparison.png - Justifie le choix NFA/DFA/min-DFA")
print("  5. graph5_aho_corasick.png - Justifie l'utilisation d'Aho-Corasick")
print("  6. graph6_decision_matrix.png - Vue d'ensemble de la sélection automatique")

