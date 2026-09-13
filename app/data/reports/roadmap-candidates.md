# Candidats de parcours — matiere premiere

> **Genere le 2026-09-12T22:58:20Z par `pnpm roadmap:candidates`. Ne pas editer a la main.**
>
> **Origine : `derived`.** Tout ce document est deduit MECANIQUEMENT des tags du
> dataset. Aucun jugement pedagogique n'y est porte.
>
> **Ce n'est pas une roadmap, et ca ne peut pas en devenir une par transformation.**
> Un regroupement par tag dit ce qui parle du meme sujet ; il ne dit ni par ou
> commencer, ni ce qui se comprend mieux apres quoi. Les donnees TryHackMe ne
> contiennent aucun prerequis et aucun ordre pedagogique. Le passage de cette liste
> a un parcours est un travail editorial, ecrit et relu a la main dans
> `data/roadmap/tracks/*.yaml`.

## Comment lire ce document

Dans chaque groupe, les rooms sont triees par **difficulte croissante**, puis par
**nombre de participants decroissant**. C'est l'ordre dans lequel on cherche un point
d'entree : le plus accessible d'abord, et parmi les equivalents, le plus frequente.

La popularite n'est pas une mesure de qualite. Elle mesure l'anciennete, la mise en
avant par TryHackMe et le bouche-a-oreille autant que l'interet du contenu.

- **714** rooms actives
- **14** technologies, **103** competences
- **170** rooms ne portent aucune technologie : elles n'apparaissent que dans
  la section competences, ou pas du tout. Ce n'est pas un defaut du dataset, c'est
  une absence de tag chez TryHackMe.

  Le rapport d'audit annonce **164** rooms sans technologie et les deux chiffres sont
  justes : 164 ont un champ `technologies` vide, et 6 de plus n'ont que `N/A`, qui
  est traite comme une ABSENCE et ne devient jamais un tag. 164 + 6 = 170.

## Par technologie

Listing complet.

### Linux — 375 rooms

| Room | Code | Difficulte | Duree | Participants |
|---|---|---|---|---|
| Burp Suite: Repeater | `burpsuiterepeater` | info | 60 min | 128 228 |
| Bypass Disable Functions | `bypassdisablefunctions` | info | 60 min | 27 474 |
| Sudo Buffer Overflow | `sudovulnsbof` | info | 30 min | 22 813 |
| OverlayFS - CVE-2021-3493 | `overlayfs` | info | 30 min | 14 984 |
| REmux The Tmux | `tmuxremux` | info | 30 min | 14 029 |
| Baron Samedit | `sudovulnssamedit` | info | 30 min | 13 822 |
| Polkit: CVE-2021-3560 | `polkit` | info | 30 min | 10 378 |
| DNS in Detail | `dnsindetail` | facile | 45 min | 776 067 |
| Introductory Networking | `introtonetworking` | facile | 20 min | 512 019 |
| Web Application Security | `introwebapplicationsecurity` | facile | 90 min | 467 561 |
| Metasploit: Introduction | `metasploitintro` | facile | 30 min | 399 769 |
| Vulnversity | `vulnversity` | facile | 45 min | 381 747 |
| Pickle Rick | `picklerick` | facile | 30 min | 381 112 |
| Basic Pentesting | `basicpentestingjt` | facile | 45 min | 341 333 |
| Intro to Digital Forensics | `introdigitalforensics` | facile | 90 min | 296 825 |
| Hydra | `hydra` | facile | 45 min | 272 193 |
| Passive Reconnaissance | `passiverecon` | facile | 60 min | 270 751 |
| OpenVPN | `openvpn` | facile | 45 min | 264 344 |
| Network Services | `networkservices` | facile | 60 min | 232 326 |
| Networking Concepts | `networkingconcepts` | facile | 60 min | 220 441 |
| Active Reconnaissance | `activerecon` | facile | 60 min | 211 922 |
| Simple CTF | `easyctf` | facile | 45 min | 200 930 |
| Vulnerabilities 101 | `vulnerabilities101` | facile | 20 min | 182 964 |
| Kenobi | `kenobi` | facile | 45 min | 175 571 |
| Cryptography Basics | `cryptographybasics` | facile | 45 min | 167 174 |
| Network Services 2 | `networkservices2` | facile | 60 min | 161 457 |
| Crack the hash | `crackthehash` | facile | 45 min | 151 961 |
| Neighbour | `neighbour` | facile | 4 min | 140 946 |
| Nmap Basic Port Scans | `nmap02` | facile | 120 min | 133 265 |
| Intro to Logs | `introtologs` | facile | 30 min | 130 126 |
| Operating Systems: Introduction | `operatingsystemsintroduction` | facile | 45 min | 125 530 |
| Common Attacks | `commonattacks` | facile | 40 min | 113 279 |
| Bounty Hacker | `cowboyhacker` | facile | 45 min | 108 225 |
| Advent of Cyber 2023 | `adventofcyber2023` | facile | 1440 min | 103 709 |
| Become a Hacker | `becomeahackeroa` | facile | 20 min | 103 040 |
| Agent Sudo | `agentsudoctf` | facile | 45 min | 102 737 |
| Linux CLI - Shells Bells | `linuxcli-aoc2025-o1fpqkvxti` | facile | 30 min | 98 521 |
| Advent of Cyber 2022 | `adventofcyber4` | facile | 1440 min | 97 004 |
| DFIR: An Introduction | `introductoryroomdfirmodule` | facile | 90 min | 96 771 |
| Overpass | `overpass` | facile | 45 min | 96 455 |
| W1seGuy | `w1seguy` | facile | 30 min | 95 192 |
| Lookup | `lookup` | facile | 60 min | 88 775 |
| LazyAdmin | `lazyadmin` | facile | 45 min | 87 330 |
| Advent of Cyber 3 (2021) | `adventofcyber3` | facile | 1440 min | 82 375 |
| Phishing - Merry Clickmas | `phishing-aoc2025-h2tkye9fzU` | facile | 30 min | 82 293 |
| Post-Exploitation Basics | `postexploit` | facile | 45 min | 75 968 |
| Ignite | `ignite` | facile | 45 min | 71 337 |
| TryHack3M: Bricks Heist | `tryhack3mbricksheist` | facile | 60 min | 70 473 |
| Bash Scripting | `bashscripting` | facile | 45 min | 69 715 |
| SQL Injection Lab | `sqlilab` | facile | 45 min | 68 936 |
| Advent of Cyber 2 [2020] | `adventofcyber2` | facile | 45 min | 68 041 |
| Fowsniff CTF | `ctf` | facile | 45 min | 65 189 |
| OpenVAS | `openvas` | facile | 45 min | 64 123 |
| Brooklyn Nine Nine | `brooklynninenine` | facile | 25 min | 62 682 |
| Network Discovery - Scan-ta Clause | `networkservices-aoc2025-jnsoqbxgky` | facile | 30 min | 52 602 |
| Passwords - A Cracking Christmas | `attacks-on-ecrypted-files-aoc2025-asdfghj123` | facile | 30 min | 51 489 |
| Cyborg | `cyborgt8` | facile | 45 min | 50 663 |
| DVWA | `dvwa` | facile | 45 min | 50 147 |
| Brute It | `bruteit` | facile | 45 min | 49 879 |
| Lo-Fi | `lofi` | facile | 5 min | 49 439 |
| Intro to Log Analysis | `introtologanalysis` | facile | 60 min | 49 245 |
| CTF collection Vol.1 | `ctfcollectionvol1` | facile | 45 min | 49 108 |
| Pyrat | `pyrat` | facile | 60 min | 48 368 |
| Easy Peasy | `easypeasyctf` | facile | 45 min | 46 805 |
| Billing | `billing` | facile | 60 min | 46 570 |
| XSS - Merry XSSMas | `xss-aoc2025-c5j8b1m4t6` | facile | 30 min | 46 086 |
| Network Security Essentials | `networksecurityessentials` | facile | 60 min | 44 325 |
| Corridor | `corridor` | facile | 5 min | 43 262 |
| Advent of Cyber 1 [2019] | `25daysofchristmas` | facile | 45 min | 42 177 |
| Linux Modules | `linuxmodules` | facile | 90 min | 41 468 |
| CyberHeroes | `cyberheroes` | facile | 15 min | 40 743 |
| tmux | `rptmux` | facile | 20 min | 40 375 |
| Lian_Yu | `lianyu` | facile | 45 min | 39 986 |
| Exploitation with cURL - Hoperation Eggsploit | `webhackingusingcurl-aoc2025-w8q1a4s7d0` | facile | 30 min | 39 586 |
| Intro to Docker | `introtodockerk8pdqk` | facile | 35 min | 39 370 |
| 25 Days of Cyber Security | `learncyberin25days` | facile | 45 min | 38 595 |
| Chill Hack | `chillhack` | facile | 45 min | 36 281 |
| Ninja Skills | `ninjaskills` | facile | 45 min | 36 093 |
| GamingServer | `gamingserver` | facile | 45 min | 35 500 |
| Guided Pentest: Infrastructure | `guidedpentestinfrastructure` | facile | 60 min | 35 340 |
| Agent T | `agentt` | facile | 10 min | 35 061 |
| Introduction to Antivirus | `introtoav` | facile | 90 min | 33 837 |
| Cheese CTF | `cheesectfv10` | facile | 60 min | 33 033 |
| Chocolate Factory | `chocolatefactory` | facile | 45 min | 31 060 |
| The Sticker Shop | `thestickershop` | facile | 120 min | 29 727 |
| Broken Access Control | `owaspbrokenaccesscontrol` | facile | 30 min | 29 465 |
| Room 404 | `hh-room404-804573bf` | facile | 30 min | 29 425 |
| Linux Logging for SOC | `linuxloggingforsoc` | facile | 45 min | 28 986 |
| Light | `lightroom` | facile | 60 min | 28 380 |
| ColddBox: Easy | `colddboxeasy` | facile | 70 min | 27 936 |
| Archangel | `archangel` | facile | 45 min | 27 785 |
| Mustacchio | `mustacchio` | facile | 45 min | 27 710 |
| U.A. High School | `yueiua` | facile | 60 min | 27 707 |
| Publisher | `publisher` | facile | 60 min | 26 642 |
| Silver Platter | `silverplatter` | facile | 180 min | 26 392 |
| Whiterose | `whiterose` | facile | 60 min | 26 005 |
| The Cod Caper | `thecodcaper` | facile | 45 min | 25 333 |
| Linux File System Analysis | `linuxfilesystemanalysis` | facile | 60 min | 23 557 |
| Fools Mate | `foolsmate` | facile | 15 min | 23 144 |
| Opacity | `opacity` | facile | 120 min | 22 557 |
| Anonforce | `bsidesgtanonforce` | facile | 45 min | 22 376 |
| kiba | `kiba` | facile | 45 min | 21 715 |
| Thompson | `bsidesgtthompson` | facile | 45 min | 21 699 |
| Madness | `madness` | facile | 45 min | 21 554 |
| Critical | `critical` | facile | 60 min | 20 736 |
| HTTP Request Smuggling | `httprequestsmuggling` | facile | 60 min | 20 693 |
| Library | `bsidesgtlibrary` | facile | 45 min | 20 599 |
| Intro to IoT Pentesting | `iotintro` | facile | 45 min | 20 570 |
| Break Out The Cage | `breakoutthecage1` | facile | 45 min | 20 310 |
| Gallery | `gallery666` | facile | 45 min | 20 146 |
| All in One | `allinonemj` | facile | 45 min | 20 026 |
| L2 MAC Flooding & ARP Spoofing | `layer2` | facile | 120 min | 19 906 |
| Dreaming | `dreaming` | facile | 45 min | 19 820 |
| Valley | `valleype` | facile | 120 min | 19 456 |
| Phishing Basics | `phishingbasics` | facile | 45 min | 18 789 |
| Forensic Imaging | `forensicimaging` | facile | 45 min | 18 742 |
| Linux Backdoors | `linuxbackdoors` | facile | 45 min | 18 741 |
| Memory Forensics | `memoryforensics` | facile | 45 min | 18 299 |
| mKingdom | `mkingdom` | facile | 60 min | 18 264 |
| Jack-of-All-Trades | `jackofalltrades` | facile | 45 min | 18 164 |
| Tech_Supp0rt: 1 | `techsupp0rt1` | facile | 90 min | 17 965 |
| DNS Manipulation | `dnsmanipulation` | facile | 30 min | 17 947 |
| Creative | `creative` | facile | 120 min | 17 857 |
| IDE | `ide` | facile | 45 min | 17 568 |
| Beach Bar | `hh-beachbar-d849f7f7` | facile | 60 min | 17 518 |
| Printer Hacking 101 | `printerhacking101` | facile | 45 min | 17 425 |
| Smag Grotto | `smaggrotto` | facile | 45 min | 17 419 |
| Content Discovery | `contentdiscoveryx` | facile | 30 min | 17 394 |
| Packed Light | `hh-packedlight-02e5330c` | facile | 60 min | 17 154 |
| Linux Incident Surface | `linuxincidentsurface` | facile | 80 min | 17 111 |
| Dav | `bsidesgtdav` | facile | 45 min | 17 106 |
| VulnNet: Roasted | `vulnnetroasted` | facile | 45 min | 16 949 |
| Bugged | `bugged` | facile | 30 min | 16 582 |
| RustScan | `rustscan` | facile | 45 min | 16 271 |
| GLITCH | `glitch` | facile | 45 min | 15 970 |
| Capture! | `capture` | facile | 180 min | 15 967 |
| VulnNet: Internal | `vulnnetinternal` | facile | 45 min | 15 595 |
| Wordpress: CVE-2021-29447 | `wordpresscve202129447` | facile | 45 min | 15 569 |
| Phishing: HiddenEye | `phishinghiddeneye` | facile | 45 min | 14 019 |
| KoTH Food CTF | `kothfoodctf` | facile | 45 min | 13 909 |
| Psycho Break | `psychobreak` | facile | 45 min | 13 665 |
| Attacking ICS Plant #1 | `attackingics1` | facile | 45 min | 13 648 |
| Hacker vs. Hacker | `hackervshacker` | facile | 60 min | 13 614 |
| Cat Pictures | `catpictures` | facile | 45 min | 13 597 |
| Intro to Cold System Forensics | `introtocoldsystemforensics` | facile | 60 min | 13 590 |
| Cat Pictures 2 | `catpictures2` | facile | 60 min | 13 387 |
| Memory Analysis Introduction | `memoryanalysisintroduction` | facile | 45 min | 13 336 |
| Flatline | `flatline` | facile | 120 min | 12 706 |
| Plotted-TMS | `plottedtms` | facile | 40 min | 12 436 |
| Tony the Tiger | `tonythetiger` | facile | 45 min | 12 368 |
| Intro To Pwntools | `introtopwntools` | facile | 45 min | 12 229 |
| Red | `redisl33t` | facile | 180 min | 12 151 |
| Brute Force Heroes | `bruteforceheroes` | facile | 120 min | 12 095 |
| Badbyte | `badbyte` | facile | 45 min | 11 997 |
| Couch | `couch` | facile | 45 min | 11 932 |
| OWASP Mutillidae II | `owaspmutillidae` | facile | 45 min | 11 756 |
| Custom Tooling Using Python | `customtoolingpython` | facile | 60 min | 11 713 |
| b3dr0ck | `b3dr0ck` | facile | 60 min | 11 656 |
| Hijack | `hijack` | facile | 120 min | 11 486 |
| AttackerKB | `attackerkb` | facile | 45 min | 11 389 |
| ParrotPost: Phishing Analysis | `parrotpost` | facile | 30 min | 11 318 |
| Jax sucks alot............. | `jason` | facile | 30 min | 10 983 |
| IR Playbooks | `irplaybooks` | facile | 60 min | 10 523 |
| JPGChat | `jpgchat` | facile | 45 min | 10 327 |
| Flip | `flip` | facile | 180 min | 9 892 |
| Hypervisor Internals | `hypervisorinternals` | facile | 35 min | 9 892 |
| 0x41haz | `0x41haz` | facile | 60 min | 9 813 |
| Intro PoC Scripting | `intropocscripting` | facile | 45 min | 9 794 |
| magician | `magician` | facile | 45 min | 9 632 |
| VulnNet: Node | `vulnnetnode` | facile | 45 min | 9 543 |
| Linux Privilege Escalation: Enumeration | `linprivenum` | facile | 60 min | 9 509 |
| Introduction to CryptOps | `introductiontocryptops` | facile | 60 min | 8 445 |
| Deja Vu | `dejavu` | facile | 90 min | 8 098 |
| Python: Core Concepts | `pythoncoreconcepts` | facile | 60 min | 7 233 |
| CVE-2026-42945: Nginx Rift | `cve202642945` | facile | 30 min | 7 128 |
| Dear QA | `dearqa` | facile | 60 min | 7 042 |
| Host-Server Configuration Reviews | `hostserverconfigurationreviews` | facile | 60 min | 6 207 |
| CVE-2026-46300: Fragnesia | `cve202646300` | facile | 30 min | 6 146 |
| CVE-2026-43284: Dirty Frag | `cve202643284` | facile | 30 min | 3 288 |
| SQL Injection | `sqlinjectionlm` | moyen | 30 min | 256 565 |
| Mr Robot CTF | `mrrobot` | moyen | 30 min | 182 860 |
| Linux Privilege Escalation | `linprivesc` | moyen | 50 min | 171 113 |
| Snort | `snort` | moyen | 120 min | 121 895 |
| Splunk Basics - Did you SIEM? | `splunkforloganalysis-aoc2025-x8fj2k4rqp` | moyen | 60 min | 71 913 |
| Wazuh | `wazuhct` | moyen | 160 min | 65 041 |
| Red Team OPSEC | `opsec` | moyen | 90 min | 64 456 |
| Blog | `blog` | moyen | 75 min | 52 840 |
| Anonymous | `anonymous` | moyen | 75 min | 45 416 |
| dogcat | `dogcat` | moyen | 75 min | 44 182 |
| Web Attack Forensics - Drone Alone | `webattackforensics-aoc2025-b4t7c1d5f8` | moyen | 30 min | 40 805 |
| UltraTech | `ultratech1` | moyen | 75 min | 37 655 |
| ICS/Modbus - Claus for Concern | `ICS-modbus-aoc2025-g3m6n9b1v4` | moyen | 60 min | 36 794 |
| C2 Detection - Command & Carol | `detecting-c2-with-rita-aoc2025-m9n2b5v8c1` | moyen | 60 min | 36 567 |
| Boiler CTF | `boilerctf2` | moyen | 75 min | 32 596 |
| MBR and GPT Analysis | `mbrandgptanalysis` | moyen | 80 min | 28 352 |
| GoldenEye | `goldeneye` | moyen | 75 min | 27 134 |
| Log Analysis with SIEM | `loganalysiswithsiem` | moyen | 90 min | 25 933 |
| Bypassing UAC | `bypassinguac` | moyen | 45 min | 25 217 |
| Linux Threat Detection 1 | `linuxthreatdetection1` | moyen | 60 min | 21 980 |
| SSRF | `ssrfhr` | moyen | 60 min | 21 593 |
| Smol | `smol` | moyen | 60 min | 19 795 |
| 0day | `0day` | moyen | 75 min | 19 573 |
| Biohazard | `biohazard` | moyen | 75 min | 18 351 |
| Overpass 3 -  Hosting | `overpass3hosting` | moyen | 75 min | 18 138 |
| Looking Glass | `lookingglass` | moyen | 75 min | 17 750 |
| Nax | `nax` | moyen | 75 min | 17 334 |
| KaffeeSec - SoMeSINT | `somesint` | moyen | 75 min | 16 414 |
| hackerNote | `hackernote` | moyen | 75 min | 16 152 |
| CMesS | `cmess` | moyen | 75 min | 15 835 |
| CTF collection Vol.2 | `ctfcollectionvol2` | moyen | 75 min | 14 743 |
| Road | `road` | moyen | 60 min | 14 659 |
| Bookstore | `bookstoreoc` | moyen | 75 min | 14 521 |
| Linux Agency | `linuxagency` | moyen | 75 min | 14 291 |
| SQHell | `sqhell` | moyen | 75 min | 13 838 |
| Linux Server Forensics | `linuxserverforensics` | moyen | 75 min | 13 452 |
| Watcher | `watcher` | moyen | 75 min | 13 148 |
| Oh My WebServer | `ohmyweb` | moyen | 60 min | 12 781 |
| ConvertMyVideo | `convertmyvideo` | moyen | 75 min | 12 676 |
| Do Not Disturb | `hh-donotdisturb-84a45644` | moyen | 60 min | 12 621 |
| TShark | `tshark` | moyen | 60 min | 12 429 |
| Introduction To Honeypots | `introductiontohoneypots` | moyen | 60 min | 12 168 |
| Olympus | `olympusroom` | moyen | 1 min | 11 965 |
| VulnNet: Active | `vulnnetactive` | moyen | 75 min | 11 943 |
| Cicada-3301 Vol:1 | `cicada3301vol1` | moyen | 75 min | 11 405 |
| Rabbit Store | `rabbitstore` | moyen | 120 min | 10 801 |
| Towel on the Sunbed | `hh-towelonthesunbed-61271709` | moyen | 45 min | 10 761 |
| Tokyo Ghoul | `tokyoghoul666` | moyen | 75 min | 10 492 |
| The Hollow Shell | `hh-thehollowshell-ddb582ac` | moyen | 60 min | 10 128 |
| PWN101 | `pwn101` | moyen | 240 min | 9 959 |
| Infinity Pool | `hh-infinitypool-5b3548af` | moyen | 60 min | 9 813 |
| The Guestbook | `hh-theguestbook-0130ffaf` | moyen | 60 min | 9 633 |
| VulnNet | `vulnnet1` | moyen | 75 min | 9 606 |
| Airplane | `airplane` | moyen | 60 min | 9 406 |
| Metasploit: The Basics | `metasploitthebasics` | moyen | 60 min | 9 349 |
| Breaking RSA | `breakrsa` | moyen | 30 min | 9 228 |
| Mindgames | `mindgames` | moyen | 75 min | 8 886 |
| Masterminds | `mastermindsxlq` | moyen | 45 min | 8 492 |
| Volatility Essentials | `volatilityessentials` | moyen | 60 min | 8 475 |
| Inferno | `inferno` | moyen | 75 min | 8 318 |
| Zeno | `zeno` | moyen | 60 min | 8 144 |
| Willow | `willow` | moyen | 75 min | 8 041 |
| Peak Hill | `peakhill` | moyen | 75 min | 8 026 |
| The London Bridge | `thelondonbridge` | moyen | 60 min | 7 944 |
| battery | `battery` | moyen | 75 min | 7 887 |
| Breakme | `breakmenu` | moyen | 160 min | 7 885 |
| Ollie | `ollie` | moyen | 60 min | 7 873 |
| That's The Ticket | `thatstheticket` | moyen | 75 min | 7 807 |
| Crypto Failures | `cryptofailures` | moyen | 60 min | 7 772 |
| Develpy | `bsidesgtdevelpy` | moyen | 75 min | 7 759 |
| Athena | `4th3n4` | moyen | 120 min | 7 722 |
| HaskHell | `haskhell` | moyen | 75 min | 7 631 |
| Classic Passwd | `classicpasswd` | moyen | 75 min | 7 574 |
| WhyHackMe | `whyhackme` | moyen | 30 min | 7 527 |
| StuxCTF | `stuxctf` | moyen | 75 min | 7 430 |
| Annie | `annie` | moyen | 60 min | 7 300 |
| Empline | `empline` | moyen | 60 min | 7 292 |
| The Impossible Challenge | `theimpossiblechallenge` | moyen | 75 min | 7 186 |
| Revenge | `revenge` | moyen | 75 min | 7 159 |
| CMSpit | `cmspit` | moyen | 75 min | 7 150 |
| Hip Flask | `hipflask` | moyen | 180 min | 7 054 |
| Eavesdropper | `eavesdropper` | moyen | 60 min | 7 037 |
| Volt Typhoon | `volttyphoon` | moyen | 90 min | 6 989 |
| Extracted | `extractedroom` | moyen | 90 min | 6 954 |
| CyberCrafted | `cybercrafted` | moyen | 120 min | 6 951 |
| Mnemonic | `mnemonic` | moyen | 75 min | 6 925 |
| One Piece | `ctfonepiece65` | moyen | 75 min | 6 828 |
| Block | `blockroom` | moyen | 120 min | 6 578 |
| VulnNet: Endgame | `vulnnetendgame` | moyen | 90 min | 6 502 |
| biteme | `biteme` | moyen | 60 min | 6 454 |
| The Server From Hell | `theserverfromhell` | moyen | 75 min | 6 344 |
| NerdHerd | `nerdherd` | moyen | 75 min | 6 309 |
| Recovery | `recovery` | moyen | 75 min | 6 217 |
| Linux Function Hooking | `linuxfunctionhooking` | moyen | 75 min | 6 092 |
| Kitty | `kitty` | moyen | 120 min | 6 040 |
| TryHack3M: Sch3Ma D3Mon | `sch3mad3mon` | moyen | 90 min | 6 022 |
| harder | `harder` | moyen | 75 min | 6 011 |
| Lunizz CTF | `lunizzctfnd` | moyen | 75 min | 5 984 |
| Madeye's Castle | `madeyescastle` | moyen | 75 min | 5 921 |
| KoTH Hackers | `kothhackers` | moyen | 75 min | 5 789 |
| Backtrack | `backtrack` | moyen | 150 min | 5 692 |
| Have a Break | `haveabreak` | moyen | 45 min | 5 663 |
| Debug | `debug` | moyen | 75 min | 5 617 |
| Jacob the Boss | `jacobtheboss` | moyen | 75 min | 5 599 |
| Sweettooth Inc. | `sweettoothinc` | moyen | 75 min | 5 481 |
| Profiles | `profilesroom` | moyen | 120 min | 5 416 |
| ContainMe | `containme1` | moyen | 60 min | 5 411 |
| Umbrella | `umbrella` | moyen | 90 min | 5 139 |
| Super Secret TIp | `supersecrettip` | moyen | 40 min | 5 128 |
| APIWizards Breach | `apiwizardsbreach` | moyen | 90 min | 5 090 |
| Unstable Twin | `unstabletwin` | moyen | 75 min | 5 025 |
| Kubernetes for Everyone | `kubernetesforyouly` | moyen | 60 min | 4 918 |
| Cactus | `cactus` | moyen | 60 min | 4 909 |
| K8s Best Security Practices | `k8sbestsecuritypractices` | moyen | 60 min | 4 890 |
| Unbaked Pie | `unbakedpie` | moyen | 75 min | 4 749 |
| Attacking ICS Plant #2 | `attackingics2` | moyen | 75 min | 4 744 |
| Minotaur's Labyrinth | `labyrinth8llv` | moyen | 120 min | 4 707 |
| Super-Spam | `superspamr` | moyen | 75 min | 4 586 |
| The Blob Blog | `theblobblog` | moyen | 75 min | 4 584 |
| Fools Mate, Revenge | `foolsm8v2` | moyen | 60 min | 4 551 |
| Undiscovered | `undiscoveredup` | moyen | 75 min | 4 513 |
| SafeZone | `safezone` | moyen | 75 min | 4 498 |
| Cooctus Stories | `cooctusadventures` | moyen | 75 min | 4 472 |
| Obscure | `obscured` | moyen | 120 min | 4 376 |
| Aster | `aster` | moyen | 75 min | 4 285 |
| VulnNet: dotpy | `vulnnetdotpy` | moyen | 75 min | 4 282 |
| Fortress | `fortress` | moyen | 60 min | 4 270 |
| ret2libc | `ret2libc` | moyen | 90 min | 4 205 |
| Metamorphosis | `metamorphosis` | moyen | 75 min | 4 173 |
| Hamlet | `hamlet` | moyen | 120 min | 4 146 |
| IR Timeline Analysis | `dfirtimelineanalysis` | moyen | 60 min | 4 145 |
| Chronicle | `chronicle` | moyen | 75 min | 3 983 |
| Forgotten Implant | `forgottenimplant` | moyen | 180 min | 3 892 |
| Exploring Wazuh | `exploringwazuh` | moyen | 60 min | 3 871 |
| Cold VVars | `coldvvars` | moyen | 75 min | 3 816 |
| Grand Larceny Auto II | `grandlarcenyautoii` | moyen | 60 min | 3 815 |
| Race Conditions Challenge | `raceconditions` | moyen | 180 min | 3 763 |
| toc2 | `toc2` | moyen | 75 min | 3 721 |
| broker | `broker` | moyen | 75 min | 3 662 |
| Crylo | `crylo4a` | moyen | 60 min | 3 651 |
| pyLon | `pylonzf` | moyen | 75 min | 3 474 |
| VulnNet: dotjar | `vulnnetdotjar` | moyen | 75 min | 3 383 |
| Red Stone One Carat | `redstoneonecarat` | moyen | 75 min | 3 203 |
| Frank & Herby make an app | `frankandherby` | moyen | 60 min | 3 179 |
| Frank and Herby try again..... | `frankandherbytryagain` | moyen | 60 min | 2 640 |
| Chain Reaction | `chainreaction-bt` | moyen | 75 min | 2 115 |
| Internal | `internal` | difficile | 120 min | 53 536 |
| The Great Disappearing Act | `sq1-aoc2025-FzPnrt2SAu` | difficile | 300 min | 37 858 |
| Advent of Cyber '24 Side Quest | `adventofcyber24sidequest` | difficile | 1337 min | 18 410 |
| HTTP/2 Request Smuggling | `http2requestsmuggling` | difficile | 45 min | 13 578 |
| Year of the Fox | `yotf` | difficile | 120 min | 13 561 |
| Enterprise | `enterprise` | difficile | 120 min | 10 253 |
| Year of the Jellyfish | `yearofthejellyfish` | difficile | 120 min | 9 525 |
| Anonymous Playground | `anonymousplayground` | difficile | 120 min | 9 376 |
| Borderlands | `borderlands` | difficile | 120 min | 9 317 |
| Rabbit Hole | `rabbitholeqq` | difficile | 120 min | 9 229 |
| Year of the Dog | `yearofthedog` | difficile | 120 min | 7 934 |
| Python Playground | `pythonplayground` | difficile | 120 min | 7 412 |
| Different CTF | `adana` | difficile | 120 min | 7 205 |
| Year of the Pig | `yearofthepig` | difficile | 120 min | 7 180 |
| Chrome | `chrome` | difficile | 180 min | 7 156 |
| Adventure Time | `adventuretime` | difficile | 120 min | 6 838 |
| Squid Game | `squidgameroom` | difficile | 130 min | 6 583 |
| Robots | `robots` | difficile | 120 min | 6 433 |
| Sea Surfer | `seasurfer` | difficile | 90 min | 5 511 |
| Uranium CTF | `uranium` | difficile | 120 min | 5 037 |
| Iron Corp | `ironcorp` | difficile | 120 min | 5 034 |
| CherryBlossom | `cherryblossom` | difficile | 120 min | 5 028 |
| EnterPrize | `enterprize` | difficile | 120 min | 4 971 |
| The Bandit Surfer | `surfingyetiiscomingtotown` | difficile | 120 min | 4 876 |
| M4tr1x: Exit Denied | `m4tr1xexitdenied` | difficile | 120 min | 4 730 |
| hc0n Christmas CTF | `hc0nchristmasctf` | difficile | 120 min | 4 700 |
| Hacking Hadoop | `hackinghadoop` | difficile | 180 min | 4 457 |
| Dave's Blog | `davesblog` | difficile | 120 min | 4 414 |
| For Business Reasons | `forbusinessreasons` | difficile | 120 min | 4 326 |
| Spring | `spring` | difficile | 45 min | 4 213 |
| Moebius | `moebius` | difficile | 90 min | 4 201 |
| Mountaineer | `mountaineerlinux` | difficile | 150 min | 4 109 |
| Racetrack Bank | `racetrackbank` | difficile | 120 min | 4 042 |
| Rocket | `rocket` | difficile | 60 min | 3 950 |
| Capture Returns | `capturereturns` | difficile | 240 min | 3 945 |
| Carpe Diem 1 | `carpediem1` | difficile | 120 min | 3 437 |
| Misguided Ghosts | `misguidedghosts` | difficile | 120 min | 3 241 |
| Contrabando | `contrabando` | difficile | 120 min | 3 180 |
| envizon | `envizon` | difficile | 120 min | 3 029 |
| GameBuzz | `gamebuzz` | difficile | 360 min | 3 011 |
| Plotted-EMR | `plottedemr` | difficile | 70 min | 2 937 |
| Plotted-LMS | `plottedlms` | difficile | 120 min | 2 823 |
| Motunui | `motunui` | difficile | 120 min | 2 808 |
| Scheme Catcher | `sq2-aoc2025-JxiOKUSD9R` | extreme | 120 min | 13 504 |
| CCT2019 | `cct2019` | extreme | 180 min | 8 047 |
| Snowy ARMageddon | `armageddon2r` | extreme | 60 min | 7 048 |
| You're in a cave | `inacave` | extreme | 180 min | 5 791 |
| Crocc Crew | `crocccrew` | extreme | 180 min | 5 402 |
| Frosteau Busy with Vim | `busyvimfrosteau` | extreme | 120 min | 5 344 |
| Theseus | `theseus` | extreme | 180 min | 3 898 |

### Web — 180 rooms

| Room | Code | Difficulte | Duree | Participants |
|---|---|---|---|---|
| Security Awareness | `securityawarenessintro` | info | 30 min | 65 052 |
| Pentesting Fundamentals | `pentestingfundamentals` | facile | 30 min | 688 404 |
| HTTP in Detail | `httpindetail` | facile | 30 min | 682 825 |
| Vulnversity | `vulnversity` | facile | 45 min | 381 747 |
| OhSINT | `ohsint` | facile | 60 min | 252 008 |
| Active Reconnaissance | `activerecon` | facile | 60 min | 211 922 |
| Simple CTF | `easyctf` | facile | 45 min | 200 930 |
| Vulnerabilities 101 | `vulnerabilities101` | facile | 20 min | 182 964 |
| Google Dorking | `googledorking` | facile | 45 min | 156 545 |
| Web Application Basics | `webapplicationbasics` | facile | 120 min | 150 363 |
| Enumeration & Brute Force | `enumerationbruteforce` | facile | 30 min | 147 780 |
| Threat Intelligence Tools | `threatinteltools` | facile | 60 min | 128 798 |
| Bounty Hacker | `cowboyhacker` | facile | 45 min | 108 225 |
| Advent of Cyber 2023 | `adventofcyber2023` | facile | 1440 min | 103 709 |
| Agent Sudo | `agentsudoctf` | facile | 45 min | 102 737 |
| Advent of Cyber 2022 | `adventofcyber4` | facile | 1440 min | 97 004 |
| Overpass | `overpass` | facile | 45 min | 96 455 |
| Lookup | `lookup` | facile | 60 min | 88 775 |
| LazyAdmin | `lazyadmin` | facile | 45 min | 87 330 |
| Guided Pentest: Web | `guidedpentestweb` | facile | 60 min | 85 056 |
| Advent of Cyber 3 (2021) | `adventofcyber3` | facile | 1440 min | 82 375 |
| Welcome | `hello` | facile | 45 min | 72 778 |
| Ignite | `ignite` | facile | 45 min | 71 337 |
| TryHack3M: Bricks Heist | `tryhack3mbricksheist` | facile | 60 min | 70 473 |
| SQL Injection Lab | `sqlilab` | facile | 45 min | 68 936 |
| Advent of Cyber 2 [2020] | `adventofcyber2` | facile | 45 min | 68 041 |
| TakeOver | `takeover` | facile | 4 min | 67 109 |
| OpenVAS | `openvas` | facile | 45 min | 64 123 |
| Introduction to OWASP ZAP | `learnowaspzap` | facile | 45 min | 51 402 |
| XSS | `axss` | facile | 120 min | 50 786 |
| Cyborg | `cyborgt8` | facile | 45 min | 50 663 |
| DVWA | `dvwa` | facile | 45 min | 50 147 |
| Pyrat | `pyrat` | facile | 60 min | 48 368 |
| Easy Peasy | `easypeasyctf` | facile | 45 min | 46 805 |
| Introduction to Django | `django` | facile | 45 min | 45 686 |
| Advent of Cyber 1 [2019] | `25daysofchristmas` | facile | 45 min | 42 177 |
| Blaster | `blaster` | facile | 30 min | 41 381 |
| How to use TryHackMe | `howtousetryhackme` | facile | 45 min | 40 757 |
| CyberHeroes | `cyberheroes` | facile | 15 min | 40 743 |
| Lian_Yu | `lianyu` | facile | 45 min | 39 986 |
| Exploitation with cURL - Hoperation Eggsploit | `webhackingusingcurl-aoc2025-w8q1a4s7d0` | facile | 30 min | 39 586 |
| SQLMAP | `sqlmap` | facile | 30 min | 39 341 |
| 25 Days of Cyber Security | `learncyberin25days` | facile | 45 min | 38 595 |
| Dig Dug | `digdug` | facile | 20 min | 37 344 |
| Race Conditions - Toy to The World | `race-conditions-aoc2025-d7f0g3h6j9` | facile | 30 min | 37 052 |
| Web Security Essentials | `websecurityessentials` | facile | 60 min | 36 796 |
| Chill Hack | `chillhack` | facile | 45 min | 36 281 |
| GamingServer | `gamingserver` | facile | 45 min | 35 500 |
| Agent T | `agentt` | facile | 10 min | 35 061 |
| Chocolate Factory | `chocolatefactory` | facile | 45 min | 31 060 |
| Detecting Web Attacks | `detectingwebattacks` | facile | 60 min | 30 014 |
| Bolt | `bolt` | facile | 45 min | 29 285 |
| MD2PDF | `md2pdf` | facile | 5 min | 29 245 |
| Breaking Crypto the Simple Way | `breakingcryptothesimpleway` | facile | 60 min | 28 182 |
| ColddBox: Easy | `colddboxeasy` | facile | 70 min | 27 936 |
| Archangel | `archangel` | facile | 45 min | 27 785 |
| Mustacchio | `mustacchio` | facile | 45 min | 27 710 |
| Getting Started | `gettingstarted` | facile | 45 min | 27 329 |
| Publisher | `publisher` | facile | 60 min | 26 642 |
| SQL Injection Introduction | `sqlinjectionintroduction` | facile | 60 min | 23 867 |
| NoSQL Injection | `nosqlinjectiontutorial` | facile | 30 min | 23 826 |
| Anonforce | `bsidesgtanonforce` | facile | 45 min | 22 376 |
| Thompson | `bsidesgtthompson` | facile | 45 min | 21 699 |
| HTTP Request Smuggling | `httprequestsmuggling` | facile | 60 min | 20 693 |
| Library | `bsidesgtlibrary` | facile | 45 min | 20 599 |
| Gallery | `gallery666` | facile | 45 min | 20 146 |
| All in One | `allinonemj` | facile | 45 min | 20 026 |
| Juicy Details | `juicydetails` | facile | 45 min | 19 853 |
| Dreaming | `dreaming` | facile | 45 min | 19 820 |
| Valley | `valleype` | facile | 120 min | 19 456 |
| mKingdom | `mkingdom` | facile | 60 min | 18 264 |
| Creative | `creative` | facile | 120 min | 17 857 |
| CyberLens | `cyberlensp6` | facile | 120 min | 17 817 |
| Writing Pentest Reports | `writingpentestreports` | facile | 60 min | 17 748 |
| IDE | `ide` | facile | 45 min | 17 568 |
| Content Discovery | `contentdiscoveryx` | facile | 30 min | 17 394 |
| Dav | `bsidesgtdav` | facile | 45 min | 17 106 |
| GLITCH | `glitch` | facile | 45 min | 15 970 |
| Wordpress: CVE-2021-29447 | `wordpresscve202129447` | facile | 45 min | 15 569 |
| WebGOAT | `webgoat` | facile | 45 min | 14 903 |
| CSRF Introduction | `csrfintroduction` | facile | 60 min | 14 367 |
| Understanding Vulnerability Databases | `understandingvulnerabilitydatabases` | facile | 60 min | 13 630 |
| Hacker vs. Hacker | `hackervshacker` | facile | 60 min | 13 614 |
| Cat Pictures 2 | `catpictures2` | facile | 60 min | 13 387 |
| Tony the Tiger | `tonythetiger` | facile | 45 min | 12 368 |
| OWASP Mutillidae II | `owaspmutillidae` | facile | 45 min | 11 756 |
| Custom Tooling Using Python | `customtoolingpython` | facile | 60 min | 11 713 |
| b3dr0ck | `b3dr0ck` | facile | 60 min | 11 656 |
| Hijack | `hijack` | facile | 120 min | 11 486 |
| WAF: Introduction | `wafintroduction` | facile | 60 min | 11 460 |
| AttackerKB | `attackerkb` | facile | 45 min | 11 389 |
| Introduction to Flask | `flask` | facile | 15 min | 10 488 |
| Insecure Randomness | `insecurerandomness` | facile | 75 min | 10 032 |
| Atlas | `atlas` | facile | 45 min | 9 657 |
| VulnNet: Node | `vulnnetnode` | facile | 45 min | 9 543 |
| Chaining Vulnerabilities | `chainingvulnerabilitiesZp` | facile | 30 min | 9 271 |
| Jupyter 101 | `jupyter101` | facile | 45 min | 9 025 |
| Deja Vu | `dejavu` | facile | 90 min | 8 098 |
| IDOR - Santa’s Little IDOR | `idor-aoc2025-zl6MywQid9` | moyen | 45 min | 58 906 |
| Blog | `blog` | moyen | 75 min | 52 840 |
| dogcat | `dogcat` | moyen | 75 min | 44 182 |
| Phishing - Phishmas Greetings | `spottingphishing-aoc2025-r2g4f6s8l0` | moyen | 30 min | 44 165 |
| Web Attack Forensics - Drone Alone | `webattackforensics-aoc2025-b4t7c1d5f8` | moyen | 30 min | 40 805 |
| CyberChef - Hoperation Save McSkidy | `encoding-decoding-aoc2025-s1a4z7x0c3` | moyen | 45 min | 39 172 |
| UltraTech | `ultratech1` | moyen | 75 min | 37 655 |
| Advanced SQL Injection | `advancedsqlinjection` | moyen | 60 min | 34 136 |
| Boiler CTF | `boilerctf2` | moyen | 75 min | 32 596 |
| GoldenEye | `goldeneye` | moyen | 75 min | 27 134 |
| Log Analysis with SIEM | `loganalysiswithsiem` | moyen | 90 min | 25 933 |
| CSRF | `csrfV2` | moyen | 60 min | 24 611 |
| NahamStore | `nahamstore` | moyen | 75 min | 23 423 |
| SSRF | `ssrfhr` | moyen | 60 min | 21 593 |
| Smol | `smol` | moyen | 60 min | 19 795 |
| Overpass 3 -  Hosting | `overpass3hosting` | moyen | 75 min | 18 138 |
| Insecure Deserialisation | `insecuredeserialisation` | moyen | 120 min | 18 115 |
| hackerNote | `hackernote` | moyen | 75 min | 16 152 |
| Bookstore | `bookstoreoc` | moyen | 75 min | 14 521 |
| Vulnerability Scanning Tools | `vulnerabilityscanningtools` | moyen | 60 min | 13 393 |
| Watcher | `watcher` | moyen | 75 min | 13 148 |
| Oh My WebServer | `ohmyweb` | moyen | 60 min | 12 781 |
| Olympus | `olympusroom` | moyen | 1 min | 11 965 |
| SSTI | `learnssti` | moyen | 75 min | 11 489 |
| Tokyo Ghoul | `tokyoghoul666` | moyen | 75 min | 10 492 |
| VulnNet | `vulnnet1` | moyen | 75 min | 9 606 |
| Airplane | `airplane` | moyen | 60 min | 9 406 |
| Wekor | `wekorra` | moyen | 75 min | 8 762 |
| Inferno | `inferno` | moyen | 75 min | 8 318 |
| Zeno | `zeno` | moyen | 60 min | 8 144 |
| Willow | `willow` | moyen | 75 min | 8 041 |
| battery | `battery` | moyen | 75 min | 7 887 |
| Ollie | `ollie` | moyen | 60 min | 7 873 |
| Athena | `4th3n4` | moyen | 120 min | 7 722 |
| HaskHell | `haskhell` | moyen | 75 min | 7 631 |
| WhyHackMe | `whyhackme` | moyen | 30 min | 7 527 |
| Empline | `empline` | moyen | 60 min | 7 292 |
| Prioritise | `prioritise` | moyen | 25 min | 7 039 |
| CyberCrafted | `cybercrafted` | moyen | 120 min | 6 951 |
| NoScope: Finding RCE | `noscoperce` | moyen | 60 min | 6 675 |
| VulnNet: Endgame | `vulnnetendgame` | moyen | 90 min | 6 502 |
| biteme | `biteme` | moyen | 60 min | 6 454 |
| TryHack3M: Sch3Ma D3Mon | `sch3mad3mon` | moyen | 90 min | 6 022 |
| harder | `harder` | moyen | 75 min | 6 011 |
| Debug | `debug` | moyen | 75 min | 5 617 |
| Clocky | `clocky` | moyen | 300 min | 5 160 |
| Umbrella | `umbrella` | moyen | 90 min | 5 139 |
| Unstable Twin | `unstabletwin` | moyen | 75 min | 5 025 |
| WWBuddy | `wwbuddy` | moyen | 75 min | 4 974 |
| Session Forensics | `sessionforensics` | moyen | 60 min | 4 779 |
| Unbaked Pie | `unbakedpie` | moyen | 75 min | 4 749 |
| Attacking ICS Plant #2 | `attackingics2` | moyen | 75 min | 4 744 |
| Undiscovered | `undiscoveredup` | moyen | 75 min | 4 513 |
| Aster | `aster` | moyen | 75 min | 4 285 |
| VulnNet: dotpy | `vulnnetdotpy` | moyen | 75 min | 4 282 |
| Fortress | `fortress` | moyen | 60 min | 4 270 |
| Web Frameworks: Code Review | `webframeworkscodereview` | moyen | 60 min | 3 805 |
| toc2 | `toc2` | moyen | 75 min | 3 721 |
| broker | `broker` | moyen | 75 min | 3 662 |
| Wazuh: CVE-2026-25769 | `wazuhcve202625769` | moyen | 45 min | 3 557 |
| AppSec IR | `appsecir` | moyen | 60 min | 3 491 |
| VulnNet: dotjar | `vulnnetdotjar` | moyen | 75 min | 3 383 |
| Re-Testing | `retesting` | moyen | 90 min | 3 223 |
| Internal | `internal` | difficile | 120 min | 53 536 |
| Advent of Cyber '24 Side Quest | `adventofcyber24sidequest` | difficile | 1337 min | 18 410 |
| HTTP/2 Request Smuggling | `http2requestsmuggling` | difficile | 45 min | 13 578 |
| Year of the Fox | `yotf` | difficile | 120 min | 13 561 |
| Enterprise | `enterprise` | difficile | 120 min | 10 253 |
| Year of the Jellyfish | `yearofthejellyfish` | difficile | 120 min | 9 525 |
| Anonymous Playground | `anonymousplayground` | difficile | 120 min | 9 376 |
| Different CTF | `adana` | difficile | 120 min | 7 205 |
| Year of the Pig | `yearofthepig` | difficile | 120 min | 7 180 |
| Adventure Time | `adventuretime` | difficile | 120 min | 6 838 |
| EnterPrize | `enterprize` | difficile | 120 min | 4 971 |
| hc0n Christmas CTF | `hc0nchristmasctf` | difficile | 120 min | 4 700 |
| Dave's Blog | `davesblog` | difficile | 120 min | 4 414 |
| For Business Reasons | `forbusinessreasons` | difficile | 120 min | 4 326 |
| Capture Returns | `capturereturns` | difficile | 240 min | 3 945 |
| Contrabando | `contrabando` | difficile | 120 min | 3 180 |
| envizon | `envizon` | difficile | 120 min | 3 029 |
| GameBuzz | `gamebuzz` | difficile | 360 min | 3 011 |
| Snowy ARMageddon | `armageddon2r` | extreme | 60 min | 7 048 |

### Windows — 116 rooms

| Room | Code | Difficulte | Duree | Participants |
|---|---|---|---|---|
| Windows Fundamentals 1 | `windowsfundamentals1xbx` | info | 30 min | 604 889 |
| Windows Fundamentals 2 | `windowsfundamentals2x0x` | info | 30 min | 464 521 |
| Introductory Networking | `introtonetworking` | facile | 20 min | 512 019 |
| Blue | `blue` | facile | 30 min | 462 476 |
| Pyramid Of Pain | `pyramidofpainax` | facile | 30 min | 326 069 |
| OpenVPN | `openvpn` | facile | 45 min | 264 344 |
| OhSINT | `ohsint` | facile | 60 min | 252 008 |
| Introduction to SIEM | `introtosiem` | facile | 120 min | 219 090 |
| Windows Command Line | `windowscommandline` | facile | 45 min | 202 043 |
| Vulnerabilities 101 | `vulnerabilities101` | facile | 20 min | 182 964 |
| Phishing Analysis Fundamentals | `phishingemails1tryoe` | facile | 30 min | 181 050 |
| Network Services 2 | `networkservices2` | facile | 60 min | 161 457 |
| Investigating Windows | `investigatingwindows` | facile | 45 min | 150 321 |
| Operating Systems: Introduction | `operatingsystemsintroduction` | facile | 45 min | 125 530 |
| Phishing Emails in Action | `phishingemails2rytmuv` | facile | 30 min | 118 695 |
| Windows Basics | `windowsbasics` | facile | 45 min | 106 857 |
| Advent of Cyber 2023 | `adventofcyber2023` | facile | 1440 min | 103 709 |
| Ice | `ice` | facile | 45 min | 98 027 |
| Advent of Cyber 2022 | `adventofcyber4` | facile | 1440 min | 97 004 |
| DFIR: An Introduction | `introductoryroomdfirmodule` | facile | 90 min | 96 771 |
| MAL: Malware Introductory | `malmalintroductory` | facile | 45 min | 91 801 |
| Intro to Endpoint Security | `introtoendpointsecurity` | facile | 60 min | 83 473 |
| Advent of Cyber 3 (2021) | `adventofcyber3` | facile | 1440 min | 82 375 |
| Introduction to EDR | `introductiontoedrs` | facile | 60 min | 71 392 |
| Advent of Cyber 2 [2020] | `adventofcyber2` | facile | 45 min | 68 041 |
| Anthem | `anthem` | facile | 45 min | 51 349 |
| Advent of Cyber 1 [2019] | `25daysofchristmas` | facile | 45 min | 42 177 |
| Blueprint | `blueprint` | facile | 45 min | 41 865 |
| Blaster | `blaster` | facile | 30 min | 41 381 |
| Malware Analysis - Malhare.exe | `htapowershell-aoc2025-p2l5k8j1h4` | facile | 60 min | 39 264 |
| 25 Days of Cyber Security | `learncyberin25days` | facile | 45 min | 38 595 |
| Windows Logging for SOC | `windowsloggingforsoc` | facile | 60 min | 36 686 |
| The Hacker Methodology | `hackermethodology` | facile | 45 min | 35 565 |
| Introduction to Windows API | `windowsapi` | facile | 60 min | 31 309 |
| Digital Forensics Case B4DM755 | `caseb4dm755` | facile | 120 min | 24 546 |
| Empire | `rppsempire` | facile | 45 min | 22 982 |
| Critical | `critical` | facile | 60 min | 20 736 |
| MAL: Researching | `malresearching` | facile | 45 min | 20 729 |
| DNS Manipulation | `dnsmanipulation` | facile | 30 min | 17 947 |
| Mobile Malware Analysis | `mma` | facile | 60 min | 15 759 |
| Soupedecode 01 | `soupedecode01` | facile | 60 min | 14 609 |
| Servidae | `servidae` | facile | 60 min | 14 487 |
| Psycho Break | `psychobreak` | facile | 45 min | 13 665 |
| Intro to Cold System Forensics | `introtocoldsystemforensics` | facile | 60 min | 13 590 |
| Memory Analysis Introduction | `memoryanalysisintroduction` | facile | 45 min | 13 336 |
| Outlook NTLM Leak | `outlookntlmleak` | facile | 45 min | 12 871 |
| Intro To Pwntools | `introtopwntools` | facile | 45 min | 12 229 |
| Hypervisor Internals | `hypervisorinternals` | facile | 35 min | 9 892 |
| Atlas | `atlas` | facile | 45 min | 9 657 |
| Registry Persistence Detection | `registrypersistencedetection` | facile | 60 min | 9 526 |
| Compromised Windows Analysis | `compromisedwindowsanalysis` | facile | 75 min | 9 048 |
| Host-Server Configuration Reviews | `hostserverconfigurationreviews` | facile | 60 min | 6 207 |
| Introduction to Windows IR | `introtowindowsir` | facile | 60 min | 1 961 |
| Attacktive Directory | `attacktivedirectory` | moyen | 75 min | 139 347 |
| Windows Forensics 1 | `windowsforensics1` | moyen | 60 min | 106 103 |
| Wazuh | `wazuhct` | moyen | 160 min | 65 041 |
| Red Team OPSEC | `opsec` | moyen | 90 min | 64 456 |
| Splunk: Exploring SPL | `splunkexploringspl` | moyen | 60 min | 57 570 |
| Malware Analysis - Egg-xecutable | `malware-sandbox-aoc2025-SD1zn4fZQt` | moyen | 45 min | 54 541 |
| Basic Malware RE | `basicmalwarere` | moyen | 75 min | 49 021 |
| Redline | `btredlinejoxr3d` | moyen | 90 min | 48 603 |
| Disk Analysis & Autopsy | `autopsy2ze0` | moyen | 45 min | 47 282 |
| YARA Rules - YARA mean one! | `yara-aoc2025-q9w1e3y5u7` | moyen | 60 min | 41 388 |
| Web Attack Forensics - Drone Alone | `webattackforensics-aoc2025-b4t7c1d5f8` | moyen | 30 min | 40 805 |
| Forensics - Registry Furensics | `registry-forensics-aoc2025-h6k9j2l5p8` | moyen | 60 min | 39 640 |
| KAPE | `kape` | moyen | 90 min | 36 631 |
| Gatekeeper | `gatekeeper` | moyen | 75 min | 30 408 |
| Preparation | `preparation` | moyen | 60 min | 28 463 |
| MBR and GPT Analysis | `mbrandgptanalysis` | moyen | 80 min | 28 352 |
| Windows PrivEsc Arena | `windowsprivescarena` | moyen | 75 min | 26 917 |
| Log Analysis with SIEM | `loganalysiswithsiem` | moyen | 90 min | 25 933 |
| Windows Threat Detection 1 | `windowsthreatdetection1` | moyen | 60 min | 23 978 |
| Carnage | `c2carnage` | moyen | 60 min | 21 673 |
| Threat Hunting: Foothold | `threathuntingfoothold` | moyen | 90 min | 21 312 |
| Identification & Scoping | `identificationandscoping` | moyen | 60 min | 19 836 |
| Investigating Windows 2.0 | `investigatingwindows2` | moyen | 45 min | 19 049 |
| Dissecting PE Headers | `dissectingpeheaders` | moyen | 120 min | 18 451 |
| Unattended | `unattended` | moyen | 60 min | 17 221 |
| Incident Response Process | `incidentresponseprocess` | moyen | 90 min | 16 126 |
| HA Joker CTF | `jokerctf` | moyen | 75 min | 16 101 |
| Windows x64 Assembly | `win64assembly` | moyen | 25 min | 15 286 |
| Conti | `contiransomwarehgh` | moyen | 45 min | 15 049 |
| Investigating Windows 3.x | `investigatingwindows3` | moyen | 45 min | 12 772 |
| AD Certificate Templates | `adcertificatetemplates` | moyen | 60 min | 12 695 |
| VulnNet: Active | `vulnnetactive` | moyen | 75 min | 11 943 |
| Windows Incident Surface | `winincidentsurface` | moyen | 180 min | 11 509 |
| Windows Reversing Intro | `windowsreversingintro` | moyen | 60 min | 11 451 |
| Threat Hunting With YARA | `threathuntingwithyara` | moyen | 90 min | 10 312 |
| Metasploit: The Basics | `metasploitthebasics` | moyen | 60 min | 9 349 |
| After Hours | `hh-afterhours-b090d1f0` | moyen | 60 min | 9 344 |
| RazorBlack | `raz0rblack` | moyen | 75 min | 8 842 |
| Hack Smarter Security | `hacksmartersecurity` | moyen | 180 min | 8 513 |
| Volatility Essentials | `volatilityessentials` | moyen | 60 min | 8 475 |
| Legal Considerations in DFIR | `dfirprocesslegalconsiderations` | moyen | 60 min | 8 380 |
| Monitoring Active Directory | `monitoringactivedirectory` | moyen | 60 min | 7 459 |
| The Impossible Challenge | `theimpossiblechallenge` | moyen | 75 min | 7 186 |
| REvil Corp | `revilcorp` | moyen | 45 min | 7 032 |
| Volt Typhoon | `volttyphoon` | moyen | 90 min | 6 989 |
| Extracted | `extractedroom` | moyen | 90 min | 6 954 |
| Block | `blockroom` | moyen | 120 min | 6 578 |
| DLL HIJACKING | `dllhijacking` | moyen | 75 min | 5 985 |
| APT28 Inception Theory | `apt28inceptiontheory` | moyen | 60 min | 5 913 |
| Dunkle Materie | `dunklematerieptxc9` | moyen | 45 min | 5 534 |
| Mayhem | `mayhemroom` | moyen | 60 min | 5 505 |
| Exploring Wazuh | `exploringwazuh` | moyen | 60 min | 3 871 |
| Grand Larceny Auto | `grandlarcenyauto` | moyen | 60 min | 3 870 |
| RDP Lateral Movement Analysis | `rdplateralmovementanalysis` | moyen | 90 min | 285 |
| Detecting LSASS Memory Dumping | `detectinglsassmemorydumping` | moyen | 60 min | 204 |
| Advent of Cyber '24 Side Quest | `adventofcyber24sidequest` | difficile | 1337 min | 18 410 |
| FAT32 Analysis | `fat32analysis` | difficile | 90 min | 10 919 |
| Management Wants a Word | `hh-managementwantsaword-6bf3cc41` | difficile | 60 min | 9 648 |
| Year of the Owl | `yearoftheowl` | difficile | 120 min | 7 702 |
| Chrome | `chrome` | difficile | 180 min | 7 156 |
| Fusion Corp | `fusioncorp` | difficile | 120 min | 4 637 |
| Operation Endgame | `operationendgame` | difficile | 60 min | 4 443 |
| Detecting Persistent DLL Attacks | `detectingpersistentdllattacks` | difficile | 120 min | 533 |

### Artificial intelligence — 15 rooms

| Room | Code | Difficulte | Duree | Participants |
|---|---|---|---|---|
| The Building Blocks of AI | `aimlsecuritythreats` | facile | 30 min | 80 902 |
| AI in Security - old sAInt nick | `AIforcyber-aoc2025-y9wWQ1zRgB` | facile | 30 min | 62 836 |
| The Concierge Knows Too Much | `hh-theconciergeknows-2d7eb4d9` | facile | 20 min | 35 654 |
| AI Threat Modelling Assessment | `aithreatmodellingassessment` | facile | 15 min | 25 424 |
| Prompt Engineering | `promptengineeringaisec` | facile | 60 min | 24 972 |
| Oracle 9 | `oracle9` | facile | 10 min | 18 427 |
| Input Manipulation & Prompt Injection | `inputmanipulationpromptinjection` | facile | 45 min | 11 257 |
| AI Security Threats | `aisecuritythreats` | facile | 30 min | 10 994 |
| Agent Design | `agentdesign` | facile | 45 min | 5 538 |
| Agent Discovery | `agentdiscovery` | facile | 30 min | 5 204 |
| AI Models & Data | `aimodelsdata` | moyen | 60 min | 30 400 |
| AI Forensics | `aiforensics` | moyen | 60 min | 22 968 |
| Securing AI Systems | `securingaisystems` | moyen | 60 min | 16 958 |
| LLM Security | `llmsecurity` | moyen | 60 min | 14 035 |
| AI Threat Modelling | `aithreatmodelling` | moyen | 60 min | 13 047 |

### Active Directory — 8 rooms

| Room | Code | Difficulte | Duree | Participants |
|---|---|---|---|---|
| VulnNet: Roasted | `vulnnetroasted` | facile | 45 min | 16 949 |
| Soupedecode 01 | `soupedecode01` | facile | 60 min | 14 609 |
| Introduction to Windows IR | `introtowindowsir` | facile | 60 min | 1 961 |
| Disk Analysis & Autopsy | `autopsy2ze0` | moyen | 45 min | 47 282 |
| Monitoring Active Directory | `monitoringactivedirectory` | moyen | 60 min | 7 459 |
| RDP Lateral Movement Analysis | `rdplateralmovementanalysis` | moyen | 90 min | 285 |
| Fusion Corp | `fusioncorp` | difficile | 120 min | 4 637 |
| Silver, Golden, and Diamond Tickets Detection | `krbticketattacks` | difficile | 90 min | 297 |

### Azure — 7 rooms

| Room | Code | Difficulte | Duree | Participants |
|---|---|---|---|---|
| Intro to Pipeline Automation | `introtopipelineautomation` | facile | 60 min | 31 946 |
| MS Sentinel: Introduction | `sentinelintroduction` | facile | 45 min | 26 883 |
| KQL (Kusto): Introduction | `kqlkustointroduction` | facile | 60 min | 9 272 |
| KQL (Kusto): Basic Queries | `kqlkustobasicqueries` | facile | 60 min | 2 042 |
| CryptoCabana | `hh-cryptocabana-f81cac95` | moyen | 60 min | 9 686 |
| XDR: Introduction | `xdrintroduction` | moyen | 60 min | 9 683 |
| M365 Monitoring Basics | `m365monitoringbasics` | moyen | 45 min | 5 923 |

### Android — 3 rooms

| Room | Code | Difficulte | Duree | Participants |
|---|---|---|---|---|
| Mobile Acquisition | `mobileacquisition` | facile | 45 min | 12 756 |
| Android Malware Analysis | `androidmalwareanalysis` | facile | 60 min | 9 581 |
| Android Hacking 101 | `androidhacking101` | moyen | 75 min | 25 274 |

### MacOs — 3 rooms

| Room | Code | Difficulte | Duree | Participants |
|---|---|---|---|---|
| OpenVPN | `openvpn` | facile | 45 min | 264 344 |
| macOS Forensics: The Basics | `macosforensicsbasics` | facile | 90 min | 11 708 |
| macOS Forensics: Artefacts | `macosforensicsartefacts` | difficile | 120 min | 5 973 |

### Docker — 2 rooms

| Room | Code | Difficulte | Duree | Participants |
|---|---|---|---|---|
| Web Frameworks: Code Review | `webframeworkscodereview` | moyen | 60 min | 3 805 |
| Wazuh: CVE-2026-25769 | `wazuhcve202625769` | moyen | 45 min | 3 557 |

### Kubernetes — 2 rooms

| Room | Code | Difficulte | Duree | Participants |
|---|---|---|---|---|
| Microservices Architectures | `microservicearchitectures` | facile | 45 min | 6 143 |
| K8s Runtime Security | `k8sruntimesecurity` | moyen | 60 min | 4 749 |

### AWS — 1 rooms

| Room | Code | Difficulte | Duree | Participants |
|---|---|---|---|---|
| Complimentary | `hh-complimentary-05e0b604` | facile | 60 min | 18 852 |

### Hypervisor — 1 rooms

| Room | Code | Difficulte | Duree | Participants |
|---|---|---|---|---|
| Hosted Hypervisors | `hostedhypervisors` | facile | 60 min | 8 205 |

### ICS/SCADA — 1 rooms

| Room | Code | Difficulte | Duree | Participants |
|---|---|---|---|---|
| Introduction to the World of OT/ICS | `introductiontotheworldofotics` | facile | 60 min | 8 671 |

### IOS — 1 rooms

| Room | Code | Difficulte | Duree | Participants |
|---|---|---|---|---|
| Mobile Acquisition | `mobileacquisition` | facile | 45 min | 12 756 |

## Par competence

Les 25 competences les plus representees, 15 rooms au plus par competence.

Le tableau complet des competences est dans `data/exports/rooms.csv`.

### Penetration testing — 289 rooms

| Room | Code | Difficulte | Duree | Participants |
|---|---|---|---|---|
| Burp Suite: Repeater | `burpsuiterepeater` | info | 60 min | 128 228 |
| Sudo Security Bypass | `sudovulnsbypass` | info | 30 min | 28 416 |
| Bypass Disable Functions | `bypassdisablefunctions` | info | 60 min | 27 474 |
| Sudo Buffer Overflow | `sudovulnsbof` | info | 30 min | 22 813 |
| OverlayFS - CVE-2021-3493 | `overlayfs` | info | 30 min | 14 984 |
| REmux The Tmux | `tmuxremux` | info | 30 min | 14 029 |
| Baron Samedit | `sudovulnssamedit` | info | 30 min | 13 822 |
| Polkit: CVE-2021-3560 | `polkit` | info | 30 min | 10 378 |
| Nmap | `furthernmap` | facile | 50 min | 573 675 |
| Introductory Networking | `introtonetworking` | facile | 20 min | 512 019 |
| Learning Cyber Security | `beginnerpathintro` | facile | 45 min | 485 264 |
| Blue | `blue` | facile | 30 min | 462 476 |
| Red Team Fundamentals | `redteamfundamentals` | facile | 20 min | 425 332 |
| Vulnversity | `vulnversity` | facile | 45 min | 381 747 |
| Pickle Rick | `picklerick` | facile | 30 min | 381 112 |

_...et 274 autres._

### Red teaming — 196 rooms

| Room | Code | Difficulte | Duree | Participants |
|---|---|---|---|---|
| History of Malware | `historyofmalware` | info | 30 min | 91 820 |
| Sudo Security Bypass | `sudovulnsbypass` | info | 30 min | 28 416 |
| Bypass Disable Functions | `bypassdisablefunctions` | info | 60 min | 27 474 |
| Sudo Buffer Overflow | `sudovulnsbof` | info | 30 min | 22 813 |
| OverlayFS - CVE-2021-3493 | `overlayfs` | info | 30 min | 14 984 |
| Baron Samedit | `sudovulnssamedit` | info | 30 min | 13 822 |
| Polkit: CVE-2021-3560 | `polkit` | info | 30 min | 10 378 |
| Nmap | `furthernmap` | facile | 50 min | 573 675 |
| Introductory Networking | `introtonetworking` | facile | 20 min | 512 019 |
| Blue | `blue` | facile | 30 min | 462 476 |
| Red Team Fundamentals | `redteamfundamentals` | facile | 20 min | 425 332 |
| Metasploit: Introduction | `metasploitintro` | facile | 30 min | 399 769 |
| Vulnversity | `vulnversity` | facile | 45 min | 381 747 |
| Pickle Rick | `picklerick` | facile | 30 min | 381 112 |
| Basic Pentesting | `basicpentestingjt` | facile | 45 min | 341 333 |

_...et 181 autres._

### Application penetration testing — 128 rooms

| Room | Code | Difficulte | Duree | Participants |
|---|---|---|---|---|
| Burp Suite: Repeater | `burpsuiterepeater` | info | 60 min | 128 228 |
| Pentesting Fundamentals | `pentestingfundamentals` | facile | 30 min | 688 404 |
| Learning Cyber Security | `beginnerpathintro` | facile | 45 min | 485 264 |
| Web Application Security | `introwebapplicationsecurity` | facile | 90 min | 467 561 |
| Pickle Rick | `picklerick` | facile | 30 min | 381 112 |
| Web Application Basics | `webapplicationbasics` | facile | 120 min | 150 363 |
| Enumeration & Brute Force | `enumerationbruteforce` | facile | 30 min | 147 780 |
| Neighbour | `neighbour` | facile | 4 min | 140 946 |
| Lookup | `lookup` | facile | 60 min | 88 775 |
| Guided Pentest: Web | `guidedpentestweb` | facile | 60 min | 85 056 |
| Anthem | `anthem` | facile | 45 min | 51 349 |
| Pyrat | `pyrat` | facile | 60 min | 48 368 |
| Blueprint | `blueprint` | facile | 45 min | 41 865 |
| SQLMAP | `sqlmap` | facile | 30 min | 39 341 |
| Race Conditions - Toy to The World | `race-conditions-aoc2025-d7f0g3h6j9` | facile | 30 min | 37 052 |

_...et 113 autres._

### Security analysis — 105 rooms

| Room | Code | Difficulte | Duree | Participants |
|---|---|---|---|---|
| Intro to LAN | `introtolan` | info | 15 min | 646 206 |
| Windows Fundamentals 1 | `windowsfundamentals1xbx` | info | 30 min | 604 889 |
| Windows Fundamentals 2 | `windowsfundamentals2x0x` | info | 30 min | 464 521 |
| History of Malware | `historyofmalware` | info | 30 min | 91 820 |
| Sudo Security Bypass | `sudovulnsbypass` | info | 30 min | 28 416 |
| DNS in Detail | `dnsindetail` | facile | 45 min | 776 067 |
| Junior Security Analyst Intro | `jrsecanalystintrouxo` | facile | 15 min | 727 512 |
| HTTP in Detail | `httpindetail` | facile | 30 min | 682 825 |
| Web Application Security | `introwebapplicationsecurity` | facile | 90 min | 467 561 |
| Starting Out In Cyber Sec | `startingoutincybersec` | facile | 10 min | 460 045 |
| Introductory Researching | `introtoresearch` | facile | 45 min | 376 438 |
| Pyramid Of Pain | `pyramidofpainax` | facile | 30 min | 326 069 |
| Intro to Digital Forensics | `introdigitalforensics` | facile | 90 min | 296 825 |
| Security Principles | `securityprinciples` | facile | 90 min | 248 569 |
| Active Reconnaissance | `activerecon` | facile | 60 min | 211 922 |

_...et 90 autres._

### Exploitation — 76 rooms

| Room | Code | Difficulte | Duree | Participants |
|---|---|---|---|---|
| Windows Fundamentals 1 | `windowsfundamentals1xbx` | info | 30 min | 604 889 |
| Windows Fundamentals 2 | `windowsfundamentals2x0x` | info | 30 min | 464 521 |
| Sudo Buffer Overflow | `sudovulnsbof` | info | 30 min | 22 813 |
| OverlayFS - CVE-2021-3493 | `overlayfs` | info | 30 min | 14 984 |
| REmux The Tmux | `tmuxremux` | info | 30 min | 14 029 |
| Baron Samedit | `sudovulnssamedit` | info | 30 min | 13 822 |
| Advent of Cyber 2023 | `adventofcyber2023` | facile | 1440 min | 103 709 |
| Advent of Cyber 2022 | `adventofcyber4` | facile | 1440 min | 97 004 |
| Advent of Cyber 3 (2021) | `adventofcyber3` | facile | 1440 min | 82 375 |
| Post-Exploitation Basics | `postexploit` | facile | 45 min | 75 968 |
| TryHack3M: Bricks Heist | `tryhack3mbricksheist` | facile | 60 min | 70 473 |
| Advent of Cyber 2 [2020] | `adventofcyber2` | facile | 45 min | 68 041 |
| XSS | `axss` | facile | 120 min | 50 786 |
| Billing | `billing` | facile | 60 min | 46 570 |
| Advent of Cyber 1 [2019] | `25daysofchristmas` | facile | 45 min | 42 177 |

_...et 61 autres._

### Privilege escalation — 66 rooms

| Room | Code | Difficulte | Duree | Participants |
|---|---|---|---|---|
| Sudo Buffer Overflow | `sudovulnsbof` | info | 30 min | 22 813 |
| Baron Samedit | `sudovulnssamedit` | info | 30 min | 13 822 |
| Kenobi | `kenobi` | facile | 45 min | 175 571 |
| Post-Exploitation Basics | `postexploit` | facile | 45 min | 75 968 |
| Advent of Cyber 1 [2019] | `25daysofchristmas` | facile | 45 min | 42 177 |
| kiba | `kiba` | facile | 45 min | 21 715 |
| mKingdom | `mkingdom` | facile | 60 min | 18 264 |
| Beach Bar | `hh-beachbar-d849f7f7` | facile | 60 min | 17 518 |
| KoTH Food CTF | `kothfoodctf` | facile | 45 min | 13 909 |
| Cat Pictures | `catpictures` | facile | 45 min | 13 597 |
| Flatline | `flatline` | facile | 120 min | 12 706 |
| Plotted-TMS | `plottedtms` | facile | 40 min | 12 436 |
| Tony the Tiger | `tonythetiger` | facile | 45 min | 12 368 |
| Jax sucks alot............. | `jason` | facile | 30 min | 10 983 |
| JPGChat | `jpgchat` | facile | 45 min | 10 327 |

_...et 51 autres._

### Digital forensics — 64 rooms

| Room | Code | Difficulte | Duree | Participants |
|---|---|---|---|---|
| Intro to Digital Forensics | `introdigitalforensics` | facile | 90 min | 296 825 |
| Crack the hash | `crackthehash` | facile | 45 min | 151 961 |
| Investigating Windows | `investigatingwindows` | facile | 45 min | 150 321 |
| Intro to Logs | `introtologs` | facile | 30 min | 130 126 |
| Advent of Cyber 2023 | `adventofcyber2023` | facile | 1440 min | 103 709 |
| Advent of Cyber 2022 | `adventofcyber4` | facile | 1440 min | 97 004 |
| DFIR: An Introduction | `introductoryroomdfirmodule` | facile | 90 min | 96 771 |
| c4ptur3-th3-fl4g | `c4ptur3th3fl4g` | facile | 45 min | 86 370 |
| Intro to Endpoint Security | `introtoendpointsecurity` | facile | 60 min | 83 473 |
| Advent of Cyber 3 (2021) | `adventofcyber3` | facile | 1440 min | 82 375 |
| Lian_Yu | `lianyu` | facile | 45 min | 39 986 |
| h4cked | `h4cked` | facile | 45 min | 36 521 |
| Digital Forensics Case B4DM755 | `caseb4dm755` | facile | 120 min | 24 546 |
| Linux File System Analysis | `linuxfilesystemanalysis` | facile | 60 min | 23 557 |
| Critical | `critical` | facile | 60 min | 20 736 |

_...et 49 autres._

### Incident response — 59 rooms

| Room | Code | Difficulte | Duree | Participants |
|---|---|---|---|---|
| Security Awareness | `securityawarenessintro` | info | 30 min | 65 052 |
| Pyramid Of Pain | `pyramidofpainax` | facile | 30 min | 326 069 |
| Introduction to SIEM | `introtosiem` | facile | 120 min | 219 090 |
| Phishing Analysis Fundamentals | `phishingemails1tryoe` | facile | 30 min | 181 050 |
| Investigating Windows | `investigatingwindows` | facile | 45 min | 150 321 |
| Intro to Logs | `introtologs` | facile | 30 min | 130 126 |
| Phishing Emails in Action | `phishingemails2rytmuv` | facile | 30 min | 118 695 |
| Common Attacks | `commonattacks` | facile | 40 min | 113 279 |
| Traffic Analysis Essentials | `trafficanalysisessentials` | facile | 30 min | 104 290 |
| DFIR: An Introduction | `introductoryroomdfirmodule` | facile | 90 min | 96 771 |
| MAL: Malware Introductory | `malmalintroductory` | facile | 45 min | 91 801 |
| Intro to Endpoint Security | `introtoendpointsecurity` | facile | 60 min | 83 473 |
| Introduction to EDR | `introductiontoedrs` | facile | 60 min | 71 392 |
| Intro to Detection Engineering | `introtodetectionengineering` | facile | 60 min | 36 103 |
| Threat Hunting: Introduction | `introductiontothreathunting` | facile | 45 min | 34 073 |

_...et 44 autres._

### Vulnerability analysis — 52 rooms

| Room | Code | Difficulte | Duree | Participants |
|---|---|---|---|---|
| Web Application Security | `introwebapplicationsecurity` | facile | 90 min | 467 561 |
| Metasploit: Introduction | `metasploitintro` | facile | 30 min | 399 769 |
| Security Engineer Intro | `securityengineerintro` | facile | 60 min | 223 194 |
| Simple CTF | `easyctf` | facile | 45 min | 200 930 |
| Vulnerabilities 101 | `vulnerabilities101` | facile | 20 min | 182 964 |
| Nessus | `rpnessusredux` | facile | 45 min | 165 920 |
| Nmap Basic Port Scans | `nmap02` | facile | 120 min | 133 265 |
| Advent of Cyber 2023 | `adventofcyber2023` | facile | 1440 min | 103 709 |
| Advent of Cyber 2022 | `adventofcyber4` | facile | 1440 min | 97 004 |
| Overpass | `overpass` | facile | 45 min | 96 455 |
| MAL: Malware Introductory | `malmalintroductory` | facile | 45 min | 91 801 |
| Lookup | `lookup` | facile | 60 min | 88 775 |
| Advent of Cyber 3 (2021) | `adventofcyber3` | facile | 1440 min | 82 375 |
| SQL Injection Lab | `sqlilab` | facile | 45 min | 68 936 |
| Fowsniff CTF | `ctf` | facile | 45 min | 65 189 |

_...et 37 autres._

### Security operations — 46 rooms

| Room | Code | Difficulte | Duree | Participants |
|---|---|---|---|---|
| DNS in Detail | `dnsindetail` | facile | 45 min | 776 067 |
| Junior Security Analyst Intro | `jrsecanalystintrouxo` | facile | 15 min | 727 512 |
| HTTP in Detail | `httpindetail` | facile | 30 min | 682 825 |
| Web Application Security | `introwebapplicationsecurity` | facile | 90 min | 467 561 |
| Pyramid Of Pain | `pyramidofpainax` | facile | 30 min | 326 069 |
| Security Engineer Intro | `securityengineerintro` | facile | 60 min | 223 194 |
| Introduction to SIEM | `introtosiem` | facile | 120 min | 219 090 |
| SOC Role in Blue Team | `socroleinblueteam` | facile | 30 min | 191 130 |
| Vulnerabilities 101 | `vulnerabilities101` | facile | 20 min | 182 964 |
| Nessus | `rpnessusredux` | facile | 45 min | 165 920 |
| Investigating Windows | `investigatingwindows` | facile | 45 min | 150 321 |
| Governance & Regulation | `cybergovernanceregulation` | facile | 120 min | 137 384 |
| SOC Fundamentals | `socfundamentals` | facile | 45 min | 132 596 |
| Intro to Logs | `introtologs` | facile | 30 min | 130 126 |
| Traffic Analysis Essentials | `trafficanalysisessentials` | facile | 30 min | 104 290 |

_...et 31 autres._

### Port scanning — 34 rooms

| Room | Code | Difficulte | Duree | Participants |
|---|---|---|---|---|
| Vulnversity | `vulnversity` | facile | 45 min | 381 747 |
| Network Services | `networkservices` | facile | 60 min | 232 326 |
| Network Services 2 | `networkservices2` | facile | 60 min | 161 457 |
| Nmap Basic Port Scans | `nmap02` | facile | 120 min | 133 265 |
| Network Discovery - Scan-ta Clause | `networkservices-aoc2025-jnsoqbxgky` | facile | 30 min | 52 602 |
| Madness | `madness` | facile | 45 min | 21 554 |
| Bugged | `bugged` | facile | 30 min | 16 582 |
| RustScan | `rustscan` | facile | 45 min | 16 271 |
| GLITCH | `glitch` | facile | 45 min | 15 970 |
| Cat Pictures | `catpictures` | facile | 45 min | 13 597 |
| Red | `redisl33t` | facile | 180 min | 12 151 |
| magician | `magician` | facile | 45 min | 9 632 |
| ICS/Modbus - Claus for Concern | `ICS-modbus-aoc2025-g3m6n9b1v4` | moyen | 60 min | 36 794 |
| Network Discovery Detection | `networkdiscoverydetection` | moyen | 60 min | 30 704 |
| GoldenEye | `goldeneye` | moyen | 75 min | 27 134 |

_...et 19 autres._

### Network penetration testing — 33 rooms

| Room | Code | Difficulte | Duree | Participants |
|---|---|---|---|---|
| Introductory Networking | `introtonetworking` | facile | 20 min | 512 019 |
| Hydra | `hydra` | facile | 45 min | 272 193 |
| Network Services | `networkservices` | facile | 60 min | 232 326 |
| Bounty Hacker | `cowboyhacker` | facile | 45 min | 108 225 |
| Ice | `ice` | facile | 45 min | 98 027 |
| Lookup | `lookup` | facile | 60 min | 88 775 |
| Wifi Hacking 101 | `wifihacking101` | facile | 45 min | 86 472 |
| Fowsniff CTF | `ctf` | facile | 45 min | 65 189 |
| Brooklyn Nine Nine | `brooklynninenine` | facile | 25 min | 62 682 |
| Network Discovery - Scan-ta Clause | `networkservices-aoc2025-jnsoqbxgky` | facile | 30 min | 52 602 |
| Brute It | `bruteit` | facile | 45 min | 49 879 |
| Pyrat | `pyrat` | facile | 60 min | 48 368 |
| Chill Hack | `chillhack` | facile | 45 min | 36 281 |
| Guided Pentest: Infrastructure | `guidedpentestinfrastructure` | facile | 60 min | 35 340 |
| Archangel | `archangel` | facile | 45 min | 27 785 |

_...et 18 autres._

### Code review — 30 rooms

| Room | Code | Difficulte | Duree | Participants |
|---|---|---|---|---|
| Neighbour | `neighbour` | facile | 4 min | 140 946 |
| W1seGuy | `w1seguy` | facile | 30 min | 95 192 |
| AI in Security - old sAInt nick | `AIforcyber-aoc2025-y9wWQ1zRgB` | facile | 30 min | 62 836 |
| Getting Started | `gettingstarted` | facile | 45 min | 27 329 |
| Madness | `madness` | facile | 45 min | 21 554 |
| GLITCH | `glitch` | facile | 45 min | 15 970 |
| Outlook NTLM Leak | `outlookntlmleak` | facile | 45 min | 12 871 |
| Introduction to Flask | `flask` | facile | 15 min | 10 488 |
| Flip | `flip` | facile | 180 min | 9 892 |
| magician | `magician` | facile | 45 min | 9 632 |
| Snyk Open Source | `snykopensource` | facile | 60 min | 8 519 |
| Learn Rust | `rust` | facile | 45 min | 7 749 |
| GoldenEye | `goldeneye` | moyen | 75 min | 27 134 |
| Airplane | `airplane` | moyen | 60 min | 9 406 |
| Mindgames | `mindgames` | moyen | 75 min | 8 886 |

_...et 15 autres._

### Threat hunting — 30 rooms

| Room | Code | Difficulte | Duree | Participants |
|---|---|---|---|---|
| Lookup | `lookup` | facile | 60 min | 88 775 |
| Easy Peasy | `easypeasyctf` | facile | 45 min | 46 805 |
| Ninja Skills | `ninjaskills` | facile | 45 min | 36 093 |
| Threat Hunting: Introduction | `introductiontothreathunting` | facile | 45 min | 34 073 |
| Chocolate Factory | `chocolatefactory` | facile | 45 min | 31 060 |
| Linux File System Analysis | `linuxfilesystemanalysis` | facile | 60 min | 23 557 |
| Critical | `critical` | facile | 60 min | 20 736 |
| Dreaming | `dreaming` | facile | 45 min | 19 820 |
| Forensic Imaging | `forensicimaging` | facile | 45 min | 18 742 |
| ParrotPost: Phishing Analysis | `parrotpost` | facile | 30 min | 11 318 |
| 0x41haz | `0x41haz` | facile | 60 min | 9 813 |
| Hosted Hypervisors | `hostedhypervisors` | facile | 60 min | 8 205 |
| Threat Hunting: Introduction | `threathuntingintroduction` | facile | 60 min | 7 257 |
| KQL (Kusto): Basic Queries | `kqlkustobasicqueries` | facile | 60 min | 2 042 |
| Redline | `btredlinejoxr3d` | moyen | 90 min | 48 603 |

_...et 15 autres._

### Exploit development — 29 rooms

| Room | Code | Difficulte | Duree | Participants |
|---|---|---|---|---|
| Metasploit: Introduction | `metasploitintro` | facile | 30 min | 399 769 |
| Compiled | `compiled` | facile | 5 min | 44 219 |
| GamingServer | `gamingserver` | facile | 45 min | 35 500 |
| Broken Access Control | `owaspbrokenaccesscontrol` | facile | 30 min | 29 465 |
| Reversing ELF | `reverselfiles` | facile | 45 min | 28 074 |
| Empire | `rppsempire` | facile | 45 min | 22 982 |
| Bugged | `bugged` | facile | 30 min | 16 582 |
| Outlook NTLM Leak | `outlookntlmleak` | facile | 45 min | 12 871 |
| Intro To Pwntools | `introtopwntools` | facile | 45 min | 12 229 |
| Red | `redisl33t` | facile | 180 min | 12 151 |
| Mr Robot CTF | `mrrobot` | moyen | 30 min | 182 860 |
| Gatekeeper | `gatekeeper` | moyen | 75 min | 30 408 |
| Looking Glass | `lookingglass` | moyen | 75 min | 17 750 |
| Nax | `nax` | moyen | 75 min | 17 334 |
| PWN101 | `pwn101` | moyen | 240 min | 9 959 |

_...et 14 autres._

### Log analysis — 24 rooms

| Room | Code | Difficulte | Duree | Participants |
|---|---|---|---|---|
| Linux CLI - Shells Bells | `linuxcli-aoc2025-o1fpqkvxti` | facile | 30 min | 98 521 |
| AI in Security - old sAInt nick | `AIforcyber-aoc2025-y9wWQ1zRgB` | facile | 30 min | 62 836 |
| XSS - Merry XSSMas | `xss-aoc2025-c5j8b1m4t6` | facile | 30 min | 46 086 |
| Network Security Essentials | `networksecurityessentials` | facile | 60 min | 44 325 |
| Windows Logging for SOC | `windowsloggingforsoc` | facile | 60 min | 36 686 |
| Detecting Web Attacks | `detectingwebattacks` | facile | 60 min | 30 014 |
| Linux Logging for SOC | `linuxloggingforsoc` | facile | 45 min | 28 986 |
| Compromised Windows Analysis | `compromisedwindowsanalysis` | facile | 75 min | 9 048 |
| Splunk Basics - Did you SIEM? | `splunkforloganalysis-aoc2025-x8fj2k4rqp` | moyen | 60 min | 71 913 |
| Wazuh | `wazuhct` | moyen | 160 min | 65 041 |
| Splunk: Exploring SPL | `splunkexploringspl` | moyen | 60 min | 57 570 |
| Web Attack Forensics - Drone Alone | `webattackforensics-aoc2025-b4t7c1d5f8` | moyen | 30 min | 40 805 |
| Log Analysis with SIEM | `loganalysiswithsiem` | moyen | 90 min | 25 933 |
| Windows Threat Detection 1 | `windowsthreatdetection1` | moyen | 60 min | 23 978 |
| Linux Threat Detection 1 | `linuxthreatdetection1` | moyen | 60 min | 21 980 |

_...et 9 autres._

### Web application security — 24 rooms

| Room | Code | Difficulte | Duree | Participants |
|---|---|---|---|---|
| Exploitation with cURL - Hoperation Eggsploit | `webhackingusingcurl-aoc2025-w8q1a4s7d0` | facile | 30 min | 39 586 |
| Race Conditions - Toy to The World | `race-conditions-aoc2025-d7f0g3h6j9` | facile | 30 min | 37 052 |
| Web Security Essentials | `websecurityessentials` | facile | 60 min | 36 796 |
| Detecting Web Attacks | `detectingwebattacks` | facile | 60 min | 30 014 |
| Room 404 | `hh-room404-804573bf` | facile | 30 min | 29 425 |
| SQL Injection Introduction | `sqlinjectionintroduction` | facile | 60 min | 23 867 |
| Fools Mate | `foolsmate` | facile | 15 min | 23 144 |
| Beach Bar | `hh-beachbar-d849f7f7` | facile | 60 min | 17 518 |
| CSRF Introduction | `csrfintroduction` | facile | 60 min | 14 367 |
| Understanding Vulnerability Databases | `understandingvulnerabilitydatabases` | facile | 60 min | 13 630 |
| WAF: Introduction | `wafintroduction` | facile | 60 min | 11 460 |
| Splunk Basics - Did you SIEM? | `splunkforloganalysis-aoc2025-x8fj2k4rqp` | moyen | 60 min | 71 913 |
| IDOR - Santa’s Little IDOR | `idor-aoc2025-zl6MywQid9` | moyen | 45 min | 58 906 |
| Vulnerability Scanning Tools | `vulnerabilityscanningtools` | moyen | 60 min | 13 393 |
| Do Not Disturb | `hh-donotdisturb-84a45644` | moyen | 60 min | 12 621 |

_...et 9 autres._

### Detection engineering — 23 rooms

| Room | Code | Difficulte | Duree | Participants |
|---|---|---|---|---|
| Introduction to SIEM | `introtosiem` | facile | 120 min | 219 090 |
| Common Attacks | `commonattacks` | facile | 40 min | 113 279 |
| Intro to Log Analysis | `introtologanalysis` | facile | 60 min | 49 245 |
| Linux Strength Training | `linuxstrengthtraining` | facile | 45 min | 37 411 |
| Intro to Detection Engineering | `introtodetectionengineering` | facile | 60 min | 36 103 |
| Intro to Pipeline Automation | `introtopipelineautomation` | facile | 60 min | 31 946 |
| ffuf | `ffuf` | facile | 45 min | 26 359 |
| Outlook NTLM Leak | `outlookntlmleak` | facile | 45 min | 12 871 |
| Jupyter 101 | `jupyter101` | facile | 45 min | 9 025 |
| Intro to Detection Engineering | `introtodetectioneng` | facile | 30 min | 7 252 |
| Snort | `snort` | moyen | 120 min | 121 895 |
| Secure Network Architecture | `introtosecurityarchitecture` | moyen | 60 min | 52 745 |
| Threat Intelligence for SOC | `threatintelligenceforsoc` | moyen | 60 min | 24 344 |
| Threat Hunting: Foothold | `threathuntingfoothold` | moyen | 90 min | 21 312 |
| Introduction To Honeypots | `introductiontohoneypots` | moyen | 60 min | 12 168 |

_...et 8 autres._

### Malware analysis — 23 rooms

| Room | Code | Difficulte | Duree | Participants |
|---|---|---|---|---|
| Intro to Digital Forensics | `introdigitalforensics` | facile | 90 min | 296 825 |
| Common Attacks | `commonattacks` | facile | 40 min | 113 279 |
| MAL: Malware Introductory | `malmalintroductory` | facile | 45 min | 91 801 |
| Malware Classification | `malwareclassification` | facile | 45 min | 36 727 |
| x86 Architecture Overview | `x8664arch` | facile | 60 min | 35 256 |
| Introduction to Antivirus | `introtoav` | facile | 90 min | 33 837 |
| MAL: Researching | `malresearching` | facile | 45 min | 20 729 |
| ParrotPost: Phishing Analysis | `parrotpost` | facile | 30 min | 11 318 |
| 0x41haz | `0x41haz` | facile | 60 min | 9 813 |
| Android Malware Analysis | `androidmalwareanalysis` | facile | 60 min | 9 581 |
| Malware Analysis - Egg-xecutable | `malware-sandbox-aoc2025-SD1zn4fZQt` | moyen | 45 min | 54 541 |
| Basic Malware RE | `basicmalwarere` | moyen | 75 min | 49 021 |
| Regular Expressions | `catregex` | moyen | 60 min | 47 247 |
| Carnage | `c2carnage` | moyen | 60 min | 21 673 |
| Dissecting PE Headers | `dissectingpeheaders` | moyen | 120 min | 18 451 |

_...et 8 autres._

### Incident handling — 21 rooms

| Room | Code | Difficulte | Duree | Participants |
|---|---|---|---|---|
| Cyber Kill Chain | `cyberkillchainzmt` | facile | 45 min | 244 441 |
| Introduction to SIEM | `introtosiem` | facile | 120 min | 219 090 |
| Investigating Windows | `investigatingwindows` | facile | 45 min | 150 321 |
| Governance & Regulation | `cybergovernanceregulation` | facile | 120 min | 137 384 |
| Intro to Logs | `introtologs` | facile | 30 min | 130 126 |
| SOC L1 Alert Triage | `socl1alerttriage` | facile | 60 min | 103 002 |
| SOC L1 Alert Reporting | `socl1alertreporting` | facile | 60 min | 89 179 |
| Introduction to EDR | `introductiontoedrs` | facile | 60 min | 71 392 |
| Digital Forensics Case B4DM755 | `caseb4dm755` | facile | 120 min | 24 546 |
| Outlook NTLM Leak | `outlookntlmleak` | facile | 45 min | 12 871 |
| Registry Persistence Detection | `registrypersistencedetection` | facile | 60 min | 9 526 |
| Preparation | `irpreparation` | facile | 45 min | 7 487 |
| Introduction to Windows IR | `introtowindowsir` | facile | 60 min | 1 961 |
| Identification & Scoping | `identificationandscoping` | moyen | 60 min | 19 836 |
| Unattended | `unattended` | moyen | 60 min | 17 221 |

_...et 6 autres._

### Reverse shell techniques — 20 rooms

| Room | Code | Difficulte | Duree | Participants |
|---|---|---|---|---|
| REmux The Tmux | `tmuxremux` | info | 30 min | 14 029 |
| Vulnversity | `vulnversity` | facile | 45 min | 381 747 |
| Network Services | `networkservices` | facile | 60 min | 232 326 |
| Billing | `billing` | facile | 60 min | 46 570 |
| mKingdom | `mkingdom` | facile | 60 min | 18 264 |
| GLITCH | `glitch` | facile | 45 min | 15 970 |
| Hacker vs. Hacker | `hackervshacker` | facile | 60 min | 13 614 |
| Red | `redisl33t` | facile | 180 min | 12 151 |
| Road | `road` | moyen | 60 min | 14 659 |
| Airplane | `airplane` | moyen | 60 min | 9 406 |
| Peak Hill | `peakhill` | moyen | 75 min | 8 026 |
| Ghizer | `ghizerctf` | moyen | 75 min | 4 826 |
| Minotaur's Labyrinth | `labyrinth8llv` | moyen | 120 min | 4 707 |
| SafeZone | `safezone` | moyen | 75 min | 4 498 |
| Hamlet | `hamlet` | moyen | 120 min | 4 146 |

_...et 5 autres._

### Scripting — 17 rooms

| Room | Code | Difficulte | Duree | Participants |
|---|---|---|---|---|
| Polkit: CVE-2021-3560 | `polkit` | info | 30 min | 10 378 |
| Python Basics | `pythonbasics` | facile | 80 min | 172 899 |
| Linux CLI - Shells Bells | `linuxcli-aoc2025-o1fpqkvxti` | facile | 30 min | 98 521 |
| Madness | `madness` | facile | 45 min | 21 554 |
| Memory Forensics | `memoryforensics` | facile | 45 min | 18 299 |
| Custom Tooling Using Python | `customtoolingpython` | facile | 60 min | 11 713 |
| magician | `magician` | facile | 45 min | 9 632 |
| Learn Rust | `rust` | facile | 45 min | 7 749 |
| Python: Core Concepts | `pythoncoreconcepts` | facile | 60 min | 7 233 |
| Breaking RSA | `breakrsa` | moyen | 30 min | 9 228 |
| Peak Hill | `peakhill` | moyen | 75 min | 8 026 |
| Prioritise | `prioritise` | moyen | 25 min | 7 039 |
| Eavesdropper | `eavesdropper` | moyen | 60 min | 7 037 |
| Kitty | `kitty` | moyen | 120 min | 6 040 |
| Super Secret TIp | `supersecrettip` | moyen | 40 min | 5 128 |

_...et 2 autres._

### OSINT — 15 rooms

| Room | Code | Difficulte | Duree | Participants |
|---|---|---|---|---|
| Passive Reconnaissance | `passiverecon` | facile | 60 min | 270 751 |
| OhSINT | `ohsint` | facile | 60 min | 252 008 |
| Cyber Kill Chain | `cyberkillchainzmt` | facile | 45 min | 244 441 |
| Google Dorking | `googledorking` | facile | 45 min | 156 545 |
| Geolocating Images | `geolocatingimages` | facile | 45 min | 26 634 |
| Overheard at Breakfast | `hh-overheardatbreakfast-6f01793c` | facile | 45 min | 20 581 |
| The Brochure | `hh-thebrochure-081f3e36` | facile | 20 min | 20 297 |
| Content Discovery | `contentdiscoveryx` | facile | 30 min | 17 394 |
| Letter | `letter` | facile | 30 min | 13 803 |
| Missing Person | `missingperson` | facile | 30 min | 13 097 |
| KaffeeSec - SoMeSINT | `somesint` | moyen | 75 min | 16 414 |
| Masterminds | `mastermindsxlq` | moyen | 45 min | 8 492 |
| Cache Me Outside | `cachemeoutside` | moyen | 60 min | 7 551 |
| Have a Break | `haveabreak` | moyen | 45 min | 5 663 |
| The Great Disappearing Act | `sq1-aoc2025-FzPnrt2SAu` | difficile | 300 min | 37 858 |

### DevSecOps — 14 rooms

| Room | Code | Difficulte | Duree | Participants |
|---|---|---|---|---|
| XSS - Merry XSSMas | `xss-aoc2025-c5j8b1m4t6` | facile | 30 min | 46 086 |
| SDLC | `sdlc` | facile | 120 min | 43 643 |
| Intro to Containerisation | `introtocontainerisation` | facile | 30 min | 40 876 |
| Intro to Pipeline Automation | `introtopipelineautomation` | facile | 60 min | 31 946 |
| JPGChat | `jpgchat` | facile | 45 min | 10 327 |
| Snyk Open Source | `snykopensource` | facile | 60 min | 8 519 |
| Introduction to CryptOps | `introductiontocryptops` | facile | 60 min | 8 445 |
| Snyk Code | `snykcode` | facile | 60 min | 6 673 |
| Microservices Architectures | `microservicearchitectures` | facile | 45 min | 6 143 |
| Insekube | `insekube` | facile | 120 min | 5 787 |
| DevSecOps Basics | `devsecopsbasics` | moyen | 120 min | 5 648 |
| Kubernetes for Everyone | `kubernetesforyouly` | moyen | 60 min | 4 918 |
| K8s Best Security Practices | `k8sbestsecuritypractices` | moyen | 60 min | 4 890 |
| K8s Runtime Security | `k8sruntimesecurity` | moyen | 60 min | 4 749 |

### Enumeration — 13 rooms

| Room | Code | Difficulte | Duree | Participants |
|---|---|---|---|---|
| Network Discovery - Scan-ta Clause | `networkservices-aoc2025-jnsoqbxgky` | facile | 30 min | 52 602 |
| Fools Mate | `foolsmate` | facile | 15 min | 23 144 |
| The Brochure | `hh-thebrochure-081f3e36` | facile | 20 min | 20 297 |
| Beach Bar | `hh-beachbar-d849f7f7` | facile | 60 min | 17 518 |
| Content Discovery | `contentdiscoveryx` | facile | 30 min | 17 394 |
| Linux Privilege Escalation: Enumeration | `linprivenum` | facile | 60 min | 9 509 |
| Do Not Disturb | `hh-donotdisturb-84a45644` | moyen | 60 min | 12 621 |
| Rabbit Store | `rabbitstore` | moyen | 120 min | 10 801 |
| The Hollow Shell | `hh-thehollowshell-ddb582ac` | moyen | 60 min | 10 128 |
| Infinity Pool | `hh-infinitypool-5b3548af` | moyen | 60 min | 9 813 |
| Fools Mate, Revenge | `foolsm8v2` | moyen | 60 min | 4 551 |
| Grand Larceny Auto | `grandlarcenyauto` | moyen | 60 min | 3 870 |
| Advent of Cyber '24 Side Quest | `adventofcyber24sidequest` | difficile | 1337 min | 18 410 |

### Les 78 autres competences

Lateral movement (13) · SIEM engineering (13) · Application security engineering (12) · AI Pentesting (11) · Incident management (10) · Network traffic analysis (10) · Brute force attacks (9) · Information gathering (9) · Log correlation (9) · Documentation (7) · Email analysis (7) · Network security engineering (7) · Packet analysis (7) · Registry forensics (7) · Static malware analysis (7) · Domain enumeration (6) · File system navigation (6) · Identity and access management (IAC) (6) · Password cracking (6) · Phishing (6) · Reconnaissance (6) · System administration (6) · User enumeration (6) · Active Directory pentesting (5) · Debugging (5) · Directory enumeration (5) · Endpoint security monitoring (5) · Cloud penetration testing (4) · Dynamic malware analysis (4) · Hash cracking (4) · Logging (4) · Mobile penetration testing (4) · Risk assessment (4) · Buffer overflow exploitation (3) · Cloud security engineering (3) · Cross-site scripting (XSS) (3) · Cryptography (3) · Cyber threat intelligence (3) · Defensive security (3) · Hardware penetration testing (3) · Log management (3) · Network monitoring (3) · Secure coding (3) · Subdomain enumeration (3) · Threat modelling (3) · Timeline analysis (3) · Adversary emulation (2) · Authentication bypass (2) · Encryption (2) · Evidence preservation (2) · Incident documentation (2) · Kernel exploitation (2) · Network troubleshooting (2) · Password attacks (2) · Prompt injection (2) · Research (2) · Reverse engineering (2) · SQL injection (2) · Threat intelligence (2) · Vulnerability management (2) · C2 development (1) · Command injection (1) · Data exfiltration (1) · Disk imaging (1) · Firewall evasion (1) · Firmware analysis (1) · Hardening (1) · Imaging (1) · Infrastructure as Code (IaC) (1) · Memory forensics (1) · Model hardening (1) · Registry analysis (1) · Security architecture (1) · Security logging configuration (1) · Security posture assessment (1) · SOAR development (1) · Social engineering (1) · YARA rule writing (1)

