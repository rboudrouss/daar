\begin{titlepage}
   \begin{center}
       \vspace*{1cm}

       \Large \textbf{Projet 1 DAAR 2025}

       \vspace{1cm}

       \textbf{Breton Noé}

        n°21516014

       \textbf{Boudrouss Réda}

        n°28712638

       \vfill

       \vspace{0.8cm}

       \includegraphics[width=0.4\textwidth]{imgs/logoSU.png}

       Sorbonne Université\\
       France

   \end{center}
\end{titlepage}

\tableofcontents

\newpage

# Introduction

Les regex, ou expressions régulières, ont été décrites pour la première fois par Stephen Cole Kleene en 1956, en s’inspirant des théories du langage formel et des théories des automates développées dans les années 1940. Les expressions régulières permettent de décrire la morphologie d’un langage et ont depuis été largement utilisées en informatique pour décrire, écrire et rechercher des motifs au sein de chaînes de caractères. De nombreux langages de programmation et utilitaires de systèmes d’exploitation utilisent ou reposent sur ces principes.

Notamment grep et sa variante étendue egrep, qui permettent la recherche textuelle dans les fichiers à l’aide d’expressions régulières.

Nous avons tenté, pendant ce projet, de répliquer le fonctionnement d’egrep, d’abord via un pattern matching, puis via une succession d’automates, afin de mieux suivre le cours et la méthode de *Alfred Aho* et *Jeff Ullman*, décrite dans le chapitre 10 de *Foundations of Computer Science*.

Nous présentons aujourd’hui notre tentative d’implémentation d’egrep en **TypeScript**.