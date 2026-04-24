
        // ══════════════════════════════════════════
        //  STATE
        // ══════════════════════════════════════════
        const PRIZES = { 1: '100% OFF', 2: '50% OFF', 3: '25% OFF', 4: '15% OFF' };
        const STORAGE_KEY = 'aw_leaderboard';
        const ATTEMPTS_PREFIX = 'aw_attempts_';
        const MAX_ATTEMPTS = 3;

        let playerHandle = '';
        let playerShortsColor = '#222222';
        let playerShortsImageData = null;
        let currentScore = 0;
        let personalBest = 0;
        let gameLoop = null;
        let gameRunning = false;

        // ══════════════════════════════════════════
        //  SCREEN MANAGEMENT
        // ══════════════════════════════════════════
        function showScreen(id) {
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            document.getElementById(id).classList.add('active');
            document.getElementById(id).scrollTop = 0;
        }

        // ══════════════════════════════════════════
        //  LOADING
        // ══════════════════════════════════════════
        window.addEventListener('load', async () => {
            await fetchServerAttempts();
            updateAttemptsDisplay();
            setTimeout(() => {
                document.getElementById('loading-overlay').classList.add('hidden');
                goToPregame();
            }, 1400);
        });

        function goToPregame() {
            drawCharPreview();
            showScreen('pregame-screen');
            updateAttemptsDisplay();
            validatePregame();
        }

        // ══════════════════════════════════════════
        //  CHARACTER PREVIEW
        // ══════════════════════════════════════════
        function drawCharacter(ctx, x, y, scale, shortsColor, shortsImgData) {
            scale = scale || 1;
            ctx.save();
            ctx.translate(x, y);
            ctx.scale(scale, scale);

            // HEAD
            ctx.fillStyle = '#e8c99a';
            ctx.fillRect(-8, -50, 16, 16);
            // HAIR
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(-8, -50, 16, 5);
            // NECK
            ctx.fillStyle = '#e8c99a';
            ctx.fillRect(-3, -34, 6, 5);

            // SHIRT (black compression)
            ctx.fillStyle = '#111111';
            ctx.fillRect(-10, -29, 20, 22);
            // Shirt detail lines
            ctx.strokeStyle = '#1e1e1e';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(-10, -22); ctx.lineTo(10, -22); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-10, -15); ctx.lineTo(10, -15); ctx.stroke();
            // "A" logo on chest
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 8px Bebas Neue, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('A', 0, -16);

            // ARMS
            ctx.fillStyle = '#111111';
            ctx.fillRect(-16, -29, 6, 18);
            ctx.fillRect(10, -29, 6, 18);
            // Forearms
            ctx.fillStyle = '#e8c99a';
            ctx.fillRect(-16, -11, 6, 8);
            ctx.fillRect(10, -11, 6, 8);

            // SHORTS — use uploaded color or image pattern
            if (shortsImgData) {
                const tmpC = document.createElement('canvas');
                tmpC.width = 20; tmpC.height = 18;
                const tmpCtx = tmpC.getContext('2d');
                const srcData = shortsImgData;
                const imgData = tmpCtx.createImageData(20, 18);
                for (let py = 0; py < 18; py++) {
                    for (let px = 0; px < 20; px++) {
                        const srcX = Math.floor(px / 20 * 50);
                        const srcY = Math.floor(py / 18 * 50);
                        const srcI = (srcY * 50 + srcX) * 4;
                        const dstI = (py * 20 + px) * 4;
                        imgData.data[dstI] = srcData.data[srcI];
                        imgData.data[dstI + 1] = srcData.data[srcI + 1];
                        imgData.data[dstI + 2] = srcData.data[srcI + 2];
                        imgData.data[dstI + 3] = 255;
                    }
                }
                tmpCtx.putImageData(imgData, 0, 0);
                ctx.drawImage(tmpC, -10, -7, 20, 18);
            } else {
                ctx.fillStyle = shortsColor || '#222';
                ctx.fillRect(-10, -7, 20, 18);
            }
            // White side stripes
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.fillRect(-10, -7, 3, 18);
            ctx.fillRect(7, -7, 3, 18);

            // LEGS
            ctx.fillStyle = '#e8c99a';
            ctx.fillRect(-9, 11, 7, 20);
            ctx.fillRect(2, 11, 7, 20);
            // Shoes
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(-10, 29, 9, 6);
            ctx.fillRect(1, 29, 9, 6);
            ctx.fillStyle = '#111111';
            ctx.fillRect(-10, 33, 9, 2);
            ctx.fillRect(1, 33, 9, 2);

            ctx.restore();
        }

        function drawCharPreview() {
            const canvas = document.getElementById('char-preview-canvas');
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, 80, 100);
            drawCharacter(ctx, 40, 70, 1.7, playerShortsColor, playerShortsImageData);
        }

        // ══════════════════════════════════════════
        //  ATTEMPTS MANAGEMENT (Server-Side IP Based)
        // ══════════════════════════════════════════
        let serverAttemptsRemaining = 0;
        let serverAttemptsUsed = 0;
        let sessionToken = null;

        async function fetchServerAttempts() {
            try {
                const res = await fetch('/api/attempts/check');
                if (res.ok) {
                    const data = await res.json();
                    serverAttemptsRemaining = data.remaining;
                    serverAttemptsUsed = data.used;
                }
            } catch(e) {
                console.error('Failed to contact Anti-Cheat Server.');
            }
        }

        function updateAttemptsDisplay() {
            const el = document.getElementById('attempts-display');
            // Hard limit visual cap
            el.innerHTML = `ATTEMPTS REMAINING: <span>∞</span>`;
        }

        // ══════════════════════════════════════════
        //  LEADERBOARD STORAGE (Global API)
        // ══════════════════════════════════════════
        async function getLeaderboard() {
            try {
                const response = await fetch('/api/leaderboard');
                if (response.ok) {
                    const data = await response.json();
                    return data;
                }
            } catch (e) {
                console.error("Failed to fetch leaderboard", e);
            }
            return [];
        }

        async function saveToLeaderboard(handle, score) {
            try {
                const response = await fetch('/api/leaderboard', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ handle, score, token: sessionToken })
                });
                if (response.ok) {
                    const data = await response.json();
                    return data;
                }
            } catch (e) {
                console.error("Failed to save score to leaderboard", e);
            }
            // Fallback: just read the list if save failed
            return await getLeaderboard();
        }

        function renderLeaderboard(entries, listEl, myHandle) {
            listEl.innerHTML = '';
            if (!entries || entries.length === 0) {
                listEl.innerHTML = '<div class="lb-empty">NO SCORES YET — BE FIRST</div>';
                return;
            }
            const top10 = entries.slice(0, 10);
            const myClean = (myHandle || '').toLowerCase().replace('@', '');
            top10.forEach((entry, i) => {
                const rank = i + 1;
                const isMe = entry.handle.toLowerCase().replace('@', '') === myClean;
                const row = document.createElement('div');
                row.className = 'lb-row' + (isMe ? ' is-me' : '');
                const badgeClass = rank <= 4 ? `lb-badge r${rank}` : '';
                const badge = PRIZES[rank] ? `<span class="${badgeClass}">${PRIZES[rank]}</span>` : '';
                const rankClass = rank <= 3 ? 'top' : '';
                row.innerHTML = `
      <span class="lb-rank ${rankClass}">${rank}</span>
      <span class="lb-handle">@${entry.handle.replace('@', '')}</span>
      <span class="lb-score">${entry.score}M</span>
      ${badge}
    `;
                listEl.appendChild(row);
            });
        }

        // ══════════════════════════════════════════
        //  PREGAME VALIDATION
        // ══════════════════════════════════════════
        const igInput = document.getElementById('ig-input');
        const followCheck = document.getElementById('follow-check');
        const playBtn = document.getElementById('play-btn');

        function validatePregame() {
            const handle = igInput.value.trim();
            const followed = followCheck.checked;
            playBtn.disabled = !(handle.length > 0 && followed && serverAttemptsRemaining > 0);
            updateAttemptsDisplay();
        }

        igInput.addEventListener('input', validatePregame);
        followCheck.addEventListener('change', validatePregame);

        // ══════════════════════════════════════════
        //  START GAME
        // ══════════════════════════════════════════
        async function startGame() {
            const handle = igInput.value.trim();
            if (serverAttemptsRemaining <= 0) {
                showLockedScreen(handle);
                return;
            }
            playerHandle = handle.startsWith('@') ? handle : '@' + handle;
            
            // Request Official Game Start from Backend
            try {
                const res = await fetch('/api/attempts/start', { method: 'POST' });
                if (!res.ok) {
                    serverAttemptsRemaining = 0;
                    showLockedScreen(handle);
                    return;
                }
                const data = await res.json();
                serverAttemptsRemaining = data.remaining;
                sessionToken = data.token; // MUST have this token to save the score!
            } catch(e) {
                alert("Connection error. Could not contact the game server.");
                return;
            }
            
            showScreen('game-screen');
            document.getElementById('hud-attempts').textContent = `${serverAttemptsRemaining} LEFT`;
            
            if (serverAttemptsUsed === 0) {
                document.getElementById('tutorial-overlay').style.display = 'flex';
            } else {
                initGame();
            }
            serverAttemptsUsed++; // Increment local view for the next logic hit
        }

        function closeTutorial() {
            document.getElementById('tutorial-overlay').style.display = 'none';
            initGame();
        }

        function showLockedScreen(handle) {
            playerHandle = handle.startsWith('@') ? handle : '@' + handle;
            document.getElementById('locked-handle').textContent = playerHandle;
            showScreen('locked-screen');
            getLeaderboard().then(lb => renderLeaderboard(lb, document.getElementById('locked-lb-list'), playerHandle));
        }

        // ══════════════════════════════════════════
        //  GAME ENGINE
        // ══════════════════════════════════════════
        const canvas = document.getElementById('game-canvas');
        const ctx = canvas.getContext('2d');

        let player, platforms, score, gameSpeed, cameraY, speedLines, tapped, particles;
        let windForce = 0, targetWindForce = 0, windChangeTimer = 0;
        let surgeFlashAlpha = 0, nextSpeedSurge = 200;
        let nextDangerZone = 500, dangerZoneActive = false, dangerZoneTimer = 0;

        function initGame() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;

            score = 0;
            gameSpeed = 2.2;
            cameraY = 0;
            speedLines = [];
            particles = [];
            tapped = null;
            highestY = 0;

            windForce = 0;
            targetWindForce = 0;
            windChangeTimer = 0;
            surgeFlashAlpha = 0;
            nextSpeedSurge = 200;
            nextDangerZone = 500;
            dangerZoneActive = false;
            dangerZoneTimer = 0;

            // Generate speed lines
            for (let i = 0; i < 30; i++) {
                speedLines.push({
                    x: Math.random() * canvas.width,
                    y: Math.random() * canvas.height,
                    len: Math.random() * 40 + 10,
                    speed: Math.random() * 3 + 1
                });
            }

            const cx = canvas.width / 2;
            const groundY = canvas.height - 100;

            player = {
                x: cx,
                y: groundY - 35,
                w: 20, h: 35,
                vy: 0,
                vx: 0,
                jumpPower: -16,
                dead: false,
                jetpackTime: 0
            };

            platforms = [];
            // Ground platform
            platforms.push({ x: 0, y: groundY, w: canvas.width, h: 20, color: '#1a1a1a' });
            let lastX = canvas.width / 2;
            let lastW = 50;
            // Generate initial platforms above
            for (let i = 1; i <= 15; i++) {
                const p = makePlatform(groundY - i * 90, i, lastX, lastW);
                platforms.push(p);
                lastX = p.x;
                lastW = p.w;
            }

            player.vy = player.jumpPower;

            // Countdown
            let count = 3;
            const overlay = document.getElementById('countdown-overlay');
            const numEl = document.getElementById('countdown-num');
            overlay.style.display = 'flex';
            numEl.textContent = count;

            const countInterval = setInterval(() => {
                count--;
                if (count <= 0) {
                    clearInterval(countInterval);
                    overlay.style.display = 'none';
                    gameRunning = true;
                    if (gameLoop) cancelAnimationFrame(gameLoop);
                    gameLoop = requestAnimationFrame(tick);
                } else {
                    numEl.textContent = count;
                    numEl.style.animation = 'none';
                    void numEl.offsetWidth;
                    numEl.style.animation = 'pop 1s ease';
                }
            }, 1000);

            // Touch controls
            canvas.ontouchstart = (e) => {
                e.preventDefault();
                if (!gameRunning) return;
                const touch = e.touches[0];
                tapped = touch.clientX < canvas.width / 2 ? 'left' : 'right';
            };
            canvas.ontouchend = () => { tapped = null; };

            // Keyboard controls
            window.onkeydown = (e) => {
                if (!gameRunning) return;
                if (e.key === 'ArrowLeft') tapped = 'left';
                if (e.key === 'ArrowRight') tapped = 'right';
            };
            window.onkeyup = (e) => {
                if ((e.key === 'ArrowLeft' && tapped === 'left') || (e.key === 'ArrowRight' && tapped === 'right')) {
                    tapped = null;
                }
            };
        }

        let highestY = 0;

        function makePlatform(y, index, prevX, prevW) {
            const minW = Math.max(40, 120 - index * 4);
            const w = Math.random() * 60 + minW;
            let x;
            
            if (prevX !== undefined && prevW !== undefined) {
                const maxJump = 200; // max safe horizontal jump
                const prevCenter = prevX + prevW / 2;
                let minX = Math.max(10, prevCenter - maxJump - w / 2);
                let maxX = Math.min(canvas.width - w - 10, prevCenter + maxJump - w / 2);
                if (maxX < minX) {
                    minX = 10;
                    maxX = canvas.width - w - 10;
                }
                x = minX + Math.random() * (maxX - minX);
            } else {
                x = Math.random() * (canvas.width - w - 20) + 10;
            }
            
            const isFragile = index > 5 && Math.random() < 0.2; // 20% chance to be fragile
            const type = isFragile ? 'fragile' : 'normal';
            
            // Evaluate projected score for this platform to force jetpacks before Danger Zones
            let hasJetpack = type === 'normal' && index > 10 && Math.random() < 0.05; // 5% base chance
            
            if (highestY > 0) {
                const projectedScore = highestY + (canvas.height/2 - y)/5;
                if (projectedScore >= nextDangerZone - 40 && projectedScore < nextDangerZone - 5) {
                    if (type === 'normal') hasJetpack = true; // Ensure they get one to survive
                }
            }

            // Moving platforms (30% chance after 15th platform)
            let isMoving = false;
            let vx = 0;
            if (index > 15 && Math.random() < 0.3) {
                isMoving = true;
                vx = (Math.random() < 0.5 ? 1 : -1) * (1 + (highestY/1000));
            }
            
            return { x, y, w, h: 14, color: isFragile ? '#8b3a3a' : '#1a1a1a', type, hasJetpack, broken: false, hp: isFragile ? 2 : 1, isMoving, vx };
        }

        function tick() {
            if (!gameRunning) return;
            update();
            render();
            gameLoop = requestAnimationFrame(tick);
        }

        function update() {
            const gravity = 0.6;
            const moveSpeed = 5;

            // ── Danger Zone countdown
            if (dangerZoneActive) {
                dangerZoneTimer--;
                if (dangerZoneTimer <= 0) dangerZoneActive = false;
            }

            // ── Wind (activates past 300M)
            if (score >= 300) {
                windChangeTimer--;
                if (windChangeTimer <= 0) {
                    targetWindForce = (Math.random() * 8) - 4;
                    if (Math.random() < 0.5) targetWindForce = 0;
                    windChangeTimer = 180 + Math.random() * 120;
                }
                windForce += (targetWindForce - windForce) * 0.01;
            } else {
                windForce = 0;
            }

            // ── Player horizontal movement
            if (tapped === 'left') player.vx = -moveSpeed;
            else if (tapped === 'right') player.vx = moveSpeed;
            else player.vx *= 0.8;
            player.vx += windForce * 0.5;

            // ── Vertical: jetpack or gravity
            if (player.jetpackTime > 0) {
                player.jetpackTime--;
                player.vy = -20;
                if (Math.random() < 0.8) {
                    particles.push({
                        x: player.x + (Math.random() - 0.5) * 10,
                        y: player.y + player.h,
                        vx: (Math.random() - 0.5) * 2,
                        vy: Math.random() * 2 + 2,
                        life: 20, maxLife: 20,
                        color: Math.random() > 0.5 ? '#00ccff' : '#0066ff'
                    });
                }
            } else {
                player.vy += gravity;
            }

            player.x += player.vx;
            player.y += player.vy;

            // ── Wrap horizontally
            if (player.x < -player.w) player.x = canvas.width;
            if (player.x > canvas.width) player.x = -player.w;

            // ── Camera follows player upward
            const screenMid = canvas.height / 2;
            if (player.y < screenMid) {
                const diff = screenMid - player.y;
                cameraY += diff;
                player.y = screenMid;
                platforms.forEach(p => p.y += diff);
                speedLines.forEach(s => s.y += diff * 0.3);
                particles.forEach(p => p.y += diff);

                score += Math.round(diff / 5);
                if (score > highestY) highestY = score;
                document.getElementById('hud-score').textContent = score + 'M';

                // Speed Surge every 200M
                if (score >= nextSpeedSurge) {
                    surgeFlashAlpha = 1.0;
                    player.vy = -18;
                    for (let i = 0; i < 30; i++) {
                        particles.push({ x: player.x, y: player.y, vx: (Math.random()-0.5)*15, vy: Math.random()*10, life: 60, maxLife: 60, color: '#ffffff' });
                    }
                    nextSpeedSurge += 200;
                }

                // Danger Zone every 500M
                if (score >= nextDangerZone && !dangerZoneActive) {
                    dangerZoneActive = true;
                    dangerZoneTimer = 120;
                    nextDangerZone += 500;
                }
            }

            // ── Moving platforms (always update position, even during danger zone)
            platforms.forEach(p => {
                if (p.isMoving && !p.broken) {
                    p.x += p.vx;
                    if (p.x < 10) { p.x = 10; p.vx *= -1; }
                    if (p.x > canvas.width - p.w - 10) { p.x = canvas.width - p.w - 10; p.vx *= -1; }
                }
            });

            // ── Platform collision (only when falling and NOT in danger zone and NOT on jetpack)
            if (player.vy > 0 && player.jetpackTime <= 0 && !dangerZoneActive) {
                platforms.forEach(p => {
                    if (p.broken) return;
                    const px = player.x - player.w / 2;
                    const py = player.y;
                    if (px + player.w > p.x && px < p.x + p.w &&
                        py + player.h >= p.y && py + player.h <= p.y + p.h + player.vy + 2) {

                        if (p.type === 'fragile') {
                            p.hp--;
                            if (p.hp <= 0) {
                                p.broken = true;
                                for (let i = 0; i < 8; i++) {
                                    particles.push({
                                        x: p.x + Math.random() * p.w,
                                        y: p.y + Math.random() * p.h,
                                        vx: (Math.random() - 0.5) * 6,
                                        vy: (Math.random() - 0.5) * 6,
                                        life: 30, maxLife: 30, color: p.color
                                    });
                                }
                                // Let player fall through broken platform
                            } else {
                                player.y = p.y - player.h;
                                player.vy = player.jumpPower;
                            }
                        } else {
                            player.y = p.y - player.h;
                            player.vy = player.jumpPower;
                        }
                    }
                });
            }

            // ── Jetpack pickup
            platforms.forEach(p => {
                if (p.hasJetpack && !p.broken) {
                    const jx = p.x + p.w / 2;
                    const jy = p.y - 20;
                    if (Math.abs(player.x - jx) < 25 && Math.abs(player.y - jy) < 40) {
                        p.hasJetpack = false;
                        player.jetpackTime = 180; // ~3 seconds of jetpack
                    }
                }
            });

            // ── Particles update
            particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.life--; });
            particles = particles.filter(p => p.life > 0);

            // ── Progressive speed & jump power
            gameSpeed = 2.2 + score / 400;
            const jumpBoost = Math.min(score / 2000, 3);
            player.jumpPower = -16 - jumpBoost;

            // ── Spawn new platforms as old ones scroll off
            platforms = platforms.filter(p => p.y < canvas.height + 50);
            while (platforms.length < 14) {
                const topPlatform = platforms.reduce((acc, p) => p.y < acc.y ? p : acc, platforms[0]);
                platforms.push(makePlatform(topPlatform.y - (70 + Math.random() * 40), score / 100, topPlatform.x, topPlatform.w));
            }

            // ── Speed lines scroll down
            speedLines.forEach(s => {
                s.y += gameSpeed * 2;
                if (player.jetpackTime > 0) s.y += 25;
                if (s.y > canvas.height + 50) {
                    s.y = -50;
                    s.x = Math.random() * canvas.width;
                }
            });

            // ── Death check
            if (player.y > canvas.height + 100) {
                gameRunning = false;
                endGame();
            }
        }

        function render() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Background
            ctx.fillStyle = '#0a0a0a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Speed lines
            const isJetpack = player.jetpackTime > 0;
            const lineOpacity = isJetpack ? 0.6 : Math.min(0.04 + score / 5000, 0.18);
            ctx.strokeStyle = `rgba(255,255,255,${lineOpacity})`;
            ctx.lineWidth = isJetpack ? 2 : 1;
            speedLines.forEach(s => {
                ctx.beginPath();
                ctx.moveTo(s.x, s.y);
                ctx.lineTo(s.x - windForce * 3, s.y + (isJetpack ? s.len * 4 : s.len));
                ctx.stroke();
            });

            // Platforms
            let drawPlatforms = true;
            if (dangerZoneActive) {
                const pulse = Math.abs(Math.sin(dangerZoneTimer / 10));
                ctx.fillStyle = `rgba(180, 0, 0, ${0.1 + pulse * 0.15})`;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                drawPlatforms = false; 
                
                ctx.fillStyle = `rgba(255, 50, 50, ${pulse})`;
                ctx.font = 'bold 36px Bebas Neue, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('DANGER ZONE', canvas.width/2, canvas.height/2 + 100);
            }

            if (drawPlatforms) {
                platforms.forEach(p => {
                    if (p.broken) return;
                    
                    ctx.fillStyle = p.color;
                    ctx.fillRect(p.x, p.y, p.w, p.h);
                    
                    if (p.type === 'fragile') {
                        ctx.strokeStyle = '#5a1a1a';
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.moveTo(p.x + p.w * 0.3, p.y);
                        ctx.lineTo(p.x + p.w * 0.4, p.y + p.h * 0.5);
                        ctx.lineTo(p.x + p.w * 0.6, p.y + p.h);
                        if (p.hp === 1) { 
                            ctx.moveTo(p.x + p.w * 0.7, p.y);
                            ctx.lineTo(p.x + p.w * 0.5, p.y + p.h);
                            ctx.moveTo(p.x + p.w * 0.2, p.y + p.h * 0.2);
                            ctx.lineTo(p.x + p.w * 0.8, p.y + p.h * 0.8);
                        }
                        ctx.stroke();
                    } else {
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(p.x, p.y, p.w, 2);
                        ctx.fillStyle = '#2a2a2a';
                        ctx.fillRect(p.x, p.y + 2, p.w, p.h - 2);
                    }

                    if (p.hasJetpack) {
                        ctx.fillStyle = '#ee4444';
                        ctx.fillRect(p.x + p.w / 2 - 8, p.y - 20, 16, 20);
                        ctx.fillStyle = '#aaaaaa';
                        ctx.fillRect(p.x + p.w / 2 - 6, p.y, 4, 4);
                        ctx.fillRect(p.x + p.w / 2 + 2, p.y, 4, 4);
                    }
                });
            }

            // Particles
            particles.forEach(p => {
                ctx.fillStyle = p.color;
                ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
                ctx.fillRect(p.x, p.y, 4, 4);
            });
            ctx.globalAlpha = 1.0;

            // Character
            const cx = player.x;
            const cy = player.y + player.h / 2;
            const running = Math.abs(player.vx) > 0.5;
            const bounce = running ? Math.sin(Date.now() / 80) * 2 : 0;
            
            if (player.jetpackTime > 0) {
                ctx.fillStyle = '#ee4444';
                ctx.fillRect(cx - 8, cy - 10, 16, 20);
                ctx.fillStyle = '#aaaaaa';
                ctx.fillRect(cx - 6, cy + 10, 4, 4);
                ctx.fillRect(cx + 2, cy + 10, 4, 4);
            }
            
            drawCharacter(ctx, cx, cy + bounce, 1, playerShortsColor, playerShortsImageData);

            // Speed Surge Flash
            if (surgeFlashAlpha > 0) {
                ctx.fillStyle = `rgba(255, 255, 255, ${surgeFlashAlpha})`;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                surgeFlashAlpha -= 0.02;
            }

            // Wind HUD Bar
            if (score >= 300) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.font = '14px Bebas Neue, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('WIND', canvas.width/2, 65);

                const maxWind = 4;
                const barW = 100;
                ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                ctx.fillRect(canvas.width/2 - barW/2, 75, barW, 4);

                const windFill = Math.min(Math.abs(windForce) / maxWind, 1.0) * (barW/2);
                ctx.fillStyle = windForce > 0 ? '#ff5555' : '#55aaff';
                if (windForce > 0) {
                    ctx.fillRect(canvas.width/2, 75, windFill, 4);
                } else {
                    ctx.fillRect(canvas.width/2 - windFill, 75, windFill, 4);
                }
            }
        }

        // ══════════════════════════════════════════
        //  END GAME
        // ══════════════════════════════════════════
        async function endGame() {
            cancelAnimationFrame(gameLoop);
            const handle = playerHandle;
            const remaining = serverAttemptsRemaining;
            const pb = parseInt(localStorage.getItem('aw_pb_' + handle) || '0');
            const isNewPB = score > pb;
            if (isNewPB) localStorage.setItem('aw_pb_' + handle, score);
            personalBest = Math.max(score, pb);

            // Save to leaderboard
            const lb = await saveToLeaderboard(handle, personalBest);

            // Result screen
            document.getElementById('result-score-num').textContent = score;
            document.getElementById('result-pb').textContent = isNewPB ? '★ NEW PERSONAL BEST' : `BEST: ${personalBest}M`;
            const remEl = document.getElementById('result-attempts-display');
            remEl.innerHTML = `ATTEMPTS REMAINING: <span>${remaining}</span>`;
            const retryBtn = document.getElementById('retry-btn');
            if (remaining <= 0) {
                retryBtn.style.display = 'none';
            } else {
                retryBtn.style.display = 'block';
            }
            renderLeaderboard(lb, document.getElementById('result-lb-list'), handle);
            showScreen('result-screen');
        }

        // ══════════════════════════════════════════
        //  SHARE
        // ══════════════════════════════════════════
        function shareScore() {
            const text = `I just hit ${score}M on the Aestrawear Apex 2.0 Challenge 🔥 Think you can beat me? @aestrawear #Apex2 #Aestrawear`;
            if (navigator.share) {
                navigator.share({ title: 'Aestrawear Apex 2.0 Challenge', text }).catch(() => { });
            } else {
                window.open('https://www.instagram.com/', '_blank');
            }
        }

        // ══════════════════════════════════════════
        //  RESIZE
        // ══════════════════════════════════════════
        window.addEventListener('resize', () => {
            if (gameRunning) {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
            }
        });

        // Prevent scroll/zoom
        document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
        document.addEventListener('gesturestart', e => e.preventDefault());
    