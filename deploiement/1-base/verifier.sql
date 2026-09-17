-- A coller dans la console Neon, onglet SQL Editor, apres l'etape 2.
--
-- Les trois chiffres attendus sont a droite. Si le premier vaut 0, les
-- commandes d'import n'ont pas ecrit : c'est presque toujours le `--apply` qui
-- manque, et elles se terminent sans erreur dans ce cas.

select count(*) as rooms   from rooms;    -- attendu : 714
select count(*) as parcours from tracks;  -- attendu : 3
select count(*) as etapes  from steps;    -- attendu : 22
