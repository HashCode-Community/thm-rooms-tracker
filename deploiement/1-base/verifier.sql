-- A coller dans la console Neon, onglet SQL Editor, apres l'etape 2.
--
-- Les chiffres attendus sont a droite. Si le premier vaut 0, les commandes
-- d'import n'ont pas ecrit : c'est presque toujours le `--apply` qui manque, et
-- elles se terminent sans erreur dans ce cas.

select count(*) as rooms       from rooms;        -- attendu : 714
select count(*) as parcours    from tracks;       -- attendu : 3
-- La table s'appelle `track_steps`, pas `steps` : `steps` n'existe pas, et la
-- requete echouait sur « relation "steps" does not exist ».
select count(*) as etapes      from track_steps;  -- attendu : 22

-- Le denominateur de la progression. Une etape peut citer des rooms en
-- complement : seules les `core` comptent dans le pourcentage affiche.
select count(*) as rooms_core  from step_rooms
where requirement = 'core';                       -- attendu : 53
