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

# Trouver un pattern qui a vraiment du préfiltrage dans les données
patterns_with_prefilter = df[df['Algorithm'].str.contains('prefilter', na=False)]['Pattern'].unique()
if len(patterns_with_prefilter) > 0:
    # Choisir un pattern représentatif (alternation de littéraux)
    test_pattern = None
    for p in patterns_with_prefilter:
        if 'cat|dog|bird' in p or 'function|class' in p:
            test_pattern = p
            break
    if test_pattern is None:
        test_pattern = patterns_with_prefilter[0]
else:
    test_pattern = '(cat|dog|bird)'

print(f"  Pattern utilisé: {test_pattern}")

# Préparer les données pour NFA et DFA séparément
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 6))

for idx, (algo_base, ax) in enumerate([('NFA', ax1), ('DFA', ax2)]):
    # Comparer avec et sans préfiltrage
    prefilter_data = df[
        (df['Algorithm'].isin([algo_base, f'{algo_base} (with prefilter)'])) &
        (df['Pattern'] == test_pattern)
    ].copy()

    if len(prefilter_data) == 0:
        print(f"  Aucune donnée pour {algo_base} avec pattern {test_pattern}")
        continue

    # Créer une colonne pour distinguer avec/sans préfiltrage
    prefilter_data['Has Prefilter'] = prefilter_data['Algorithm'].str.contains('prefilter')
    prefilter_data['Text Size (KB)'] = prefilter_data['Text Length'] / 1024

    # Temps total avec et sans préfiltrage
    text_sizes = sorted(prefilter_data['Text Size (KB)'].unique())

    without_prefilter_times = []
    with_prefilter_times = []

    for size in text_sizes:
        data_size = prefilter_data[prefilter_data['Text Size (KB)'] == size]

        without = data_size[~data_size['Has Prefilter']]['Total Time (ms)'].mean()
        with_pf = data_size[data_size['Has Prefilter']]['Total Time (ms)'].mean()

        without_prefilter_times.append(without if not np.isnan(without) else 0)
        with_prefilter_times.append(with_pf if not np.isnan(with_pf) else 0)

    # Filtrer les valeurs nulles
    valid_indices = [i for i in range(len(text_sizes))
                     if without_prefilter_times[i] > 0 or with_prefilter_times[i] > 0]

    if len(valid_indices) == 0:
        print(f"  Aucune donnée valide pour {algo_base}")
        continue

    text_sizes_valid = [text_sizes[i] for i in valid_indices]
    without_valid = [without_prefilter_times[i] for i in valid_indices]
    with_valid = [with_prefilter_times[i] for i in valid_indices]

    ax.plot(text_sizes_valid, without_valid, marker='o', label='Sans préfiltrage',
            linewidth=2.5, markersize=10, color='#1f77b4')
    ax.plot(text_sizes_valid, with_valid, marker='s', label='Avec préfiltrage',
            linewidth=2.5, markersize=10, color='#ff7f0e')

    ax.set_xlabel('Taille du Texte (KB)', fontsize=12)
    ax.set_ylabel('Temps Total (ms)', fontsize=12)

    # Simplifier le titre du pattern s'il est trop long
    pattern_display = test_pattern if len(test_pattern) < 30 else test_pattern[:27] + '...'
    ax.set_title(f'Impact du préfiltrage - {algo_base}\n(Pattern: {pattern_display})',
                 fontsize=13, fontweight='bold')
    ax.legend(fontsize=11, loc='best')
    ax.grid(True, alpha=0.3)
    ax.set_xscale('log')

    # Ajouter ligne de seuil à 10KB
    ax.axvline(x=10, color='red', linestyle='--', alpha=0.6, linewidth=2)

    # Ajouter annotation pour le seuil
    y_min, y_max = ax.get_ylim()
    y_pos = y_min + (y_max - y_min) * 0.85
    ax.text(10.5, y_pos, 'Seuil\n(10 KB)', fontsize=10, color='red',
            bbox=dict(boxstyle='round', facecolor='white', alpha=0.8, edgecolor='red'))

plt.tight_layout()
plt.savefig('imgs/graph3_prefilter_impact.png', bbox_inches='tight')
print("  -> Sauvegardé: imgs/graph3_prefilter_impact.png")
plt.close()

# ============================================================================
# GRAPHIQUE 4: NFA vs DFA vs min-DFA vs NFA+DFA-cache selon la taille du texte
# Justifie: "NFA pour très petit (<500B), NFA+DFA-cache pour petit (500B-10KB), DFA/min-DFA sinon"
# ============================================================================
print("Génération du graphique 4: Choix d'algorithme selon la taille du texte...")

# Choisir un pattern représentatif (regex simple)
automata_data = df[
    (df['Algorithm'].isin(['NFA', 'NFA+DFA-cache', 'DFA', 'min-DFA'])) &
    (~df['Algorithm'].str.contains('prefilter', na=False))
].copy()

# Ajouter la taille du texte en KB
automata_data['Text Size (KB)'] = automata_data['Text Length'] / 1024

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 6))

# Graphique 1: Performance selon la taille du texte (pour un pattern modérément complexe)
# Choisir un pattern qui montre bien les différences sans être pathologique
all_patterns = automata_data['Pattern'].unique()
test_pattern = None

# Chercher un pattern avec un coût de construction DFA significatif
moderate_patterns = [
    '(the|and|that|with|from)(.*)(the|and|that|with|from)',
    '(a|b)*c(d|e)*',
    '(abc|abd|abe)*',
    '(a|b).*c',
    'ab*c'
]

for p in moderate_patterns:
    if p in all_patterns:
        test_pattern = p
        break

# Fallback sur un pattern simple si aucun pattern n'est trouvé
if test_pattern is None:
    for p in all_patterns:
        if p in ['a.c', 'a.*b']:
            test_pattern = p
            break

if test_pattern is None and len(all_patterns) > 0:
    test_pattern = all_patterns[0]

if test_pattern:
    pattern_data = automata_data[automata_data['Pattern'] == test_pattern].copy()

    for algo in ['NFA', 'NFA+DFA-cache', 'DFA', 'min-DFA']:
        algo_data = pattern_data[pattern_data['Algorithm'] == algo]
        if len(algo_data) > 0:
            # Grouper par taille de texte et calculer la moyenne
            grouped = algo_data.groupby('Text Size (KB)')['Total Time (ms)'].mean().reset_index()
            ax1.plot(grouped['Text Size (KB)'], grouped['Total Time (ms)'],
                    marker='o', label=algo, linewidth=2.5, markersize=8,
                    color=algo_colors[algo])

    ax1.set_xlabel('Taille du Texte (KB)', fontsize=12)
    ax1.set_ylabel('Temps Total (ms)', fontsize=12)

    # Simplifier le titre si le pattern est trop long
    pattern_display = test_pattern if len(test_pattern) < 40 else test_pattern[:37] + '...'
    ax1.set_title(f'Performance selon la taille du texte\n(Pattern: {pattern_display})',
                  fontsize=13, fontweight='bold')
    ax1.legend(fontsize=11, loc='upper left')
    ax1.grid(True, alpha=0.3)
    ax1.set_xscale('log')
    ax1.set_yscale('log')

    # Note: Pour les patterns simples testés, le DFA est souvent optimal même pour petits textes
    # car le coût de construction est très faible. Les seuils théoriques s'appliquent
    # surtout pour des patterns très complexes avec explosion d'états.

# Graphique 2: Ratio Build Time / Total Time (montre l'amortissement)
for algo in ['NFA', 'NFA+DFA-cache', 'DFA', 'min-DFA']:
    algo_data = automata_data[automata_data['Algorithm'] == algo].copy()
    if len(algo_data) > 0:
        # Calculer le ratio Build / Total
        algo_data['Build Ratio (%)'] = (algo_data['Build Time (ms)'] / algo_data['Total Time (ms)'] * 100)

        # Grouper par taille de texte
        grouped = algo_data.groupby('Text Size (KB)')['Build Ratio (%)'].mean().reset_index()

        ax2.plot(grouped['Text Size (KB)'], grouped['Build Ratio (%)'],
                marker='o', label=algo, linewidth=2.5, markersize=8,
                color=algo_colors[algo])

ax2.set_xlabel('Taille du Texte (KB)', fontsize=12)
ax2.set_ylabel('Part du temps de construction (%)', fontsize=12)
ax2.set_title('Amortissement du coût de construction\n(% du temps total)',
              fontsize=13, fontweight='bold')
ax2.legend(fontsize=11)
ax2.grid(True, alpha=0.3)
ax2.set_xscale('log')
ax2.axhline(y=50, color='red', linestyle='--', alpha=0.5, linewidth=1.5)
ax2.text(ax2.get_xlim()[1]*0.7, 52, 'Construction = 50% du temps',
         fontsize=9, color='red')

plt.tight_layout()
plt.savefig('imgs/graph4_automata_comparison.png', bbox_inches='tight')
print("  -> Sauvegardé: imgs/graph4_automata_comparison.png")
plt.close()

# ============================================================================
# GRAPHIQUE 7: Cas pathologique - Explosion exponentielle du DFA
# Montre le pire cas pour le DFA avec (a|b)*a(a|b){12}
# ============================================================================
print("Génération du graphique 7: Cas pathologique du DFA...")

worst_case_pattern = '(a|b)*a(a|b)(a|b)(a|b)(a|b)(a|b)(a|b)(a|b)(a|b)(a|b)(a|b)(a|b)'

worst_case_data = df[
    (df['Pattern'] == worst_case_pattern) &
    (df['Algorithm'].isin(['NFA', 'NFA+DFA-cache', 'DFA', 'min-DFA'])) &
    (~df['Algorithm'].str.contains('prefilter', na=False))
].copy()

if len(worst_case_data) > 0:
    worst_case_data['Text Size (KB)'] = worst_case_data['Text Length'] / 1024

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 6))

    # Graphique 1: Temps total
    for algo in ['NFA', 'NFA+DFA-cache', 'DFA', 'min-DFA']:
        algo_data = worst_case_data[worst_case_data['Algorithm'] == algo]
        if len(algo_data) > 0:
            grouped = algo_data.groupby('Text Size (KB)')['Total Time (ms)'].mean().reset_index()
            ax1.plot(grouped['Text Size (KB)'], grouped['Total Time (ms)'],
                    marker='o', label=algo, linewidth=2.5, markersize=8,
                    color=algo_colors[algo])

    ax1.set_xlabel('Taille du Texte (KB)', fontsize=12)
    ax1.set_ylabel('Temps Total (ms)', fontsize=12)
    ax1.set_title(f'Cas pathologique: Explosion du DFA\n(Pattern: (a|b)*a(a|b){{12}})',
                  fontsize=13, fontweight='bold')
    ax1.legend(fontsize=11)
    ax1.grid(True, alpha=0.3)
    ax1.set_xscale('log')
    ax1.set_yscale('log')

    # Graphique 2: Taille de structure (nombre d'états)
    for algo in ['NFA', 'DFA', 'min-DFA']:
        algo_data = worst_case_data[worst_case_data['Algorithm'] == algo]
        if len(algo_data) > 0:
            # Prendre la première valeur car la taille de structure ne change pas avec le texte
            structure_size = algo_data['Structure Nodes'].iloc[0]
            ax2.bar(algo, structure_size, color=algo_colors[algo], alpha=0.7)

    ax2.set_ylabel('Nombre d\'États', fontsize=12)
    ax2.set_title('Explosion exponentielle du nombre d\'états\n(DFA: 2^12 = 4096 états)',
                  fontsize=13, fontweight='bold')
    ax2.set_yscale('log')
    ax2.grid(True, alpha=0.3, axis='y')

    # Ajouter les valeurs sur les barres
    for i, algo in enumerate(['NFA', 'DFA', 'min-DFA']):
        algo_data = worst_case_data[worst_case_data['Algorithm'] == algo]
        if len(algo_data) > 0:
            structure_size = algo_data['Structure Nodes'].iloc[0]
            ax2.text(i, structure_size * 1.2, f'{int(structure_size)}',
                    ha='center', va='bottom', fontsize=10, fontweight='bold')

    plt.tight_layout()
    plt.savefig('imgs/graph7_worst_case_dfa.png', bbox_inches='tight')
    print("  -> Sauvegardé: imgs/graph7_worst_case_dfa.png")
    plt.close()
else:
    print("  -> Aucune donnée pour le cas pathologique")

print("\nTous les graphiques ont été générés avec succès!")
print("\nGraphiques générés:")
print("  1. graph1_kmp_vs_boyermoore.png - Justifie le choix KMP vs Boyer-Moore")
print("  2. graph2_structure_size.png - Justifie l'intérêt de la minimisation")
print("  3. graph3_prefilter_impact.png - Justifie quand activer le préfiltrage")
print("  4. graph4_automata_comparison.png - Justifie le choix NFA/DFA/min-DFA")
print("  7. graph7_worst_case_dfa.png - Cas pathologique du DFA (explosion exponentielle)")

