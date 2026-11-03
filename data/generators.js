// Fresh numbers for calculation questions. A question with `"generator": "<name>"` in
// questions.json is rebuilt by QUIZ_GENERATORS[name]() at the start of every run; the
// static fields in questions.json are the fallback if a generator is missing or throws.
// Each generator returns { question, options, correct, optionNotes, explanation, explanationZh, steps }.
(function () {
    const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];
    const shuffle = arr => {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    };
    const num = (x, d = 2) => String(+x.toFixed(d));
    const sci = x => { const [m, e] = x.toExponential(2).split('e'); return `${m}E${Number(e)}`; };
    const tex = x => { const [m, e] = x.toExponential(2).split('e'); return `${m}\\times10^{${Number(e)}}`; };
    const hex = x => '0x' + (x & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
    const minus = x => String(x).replace('-', '−');

    // The first three distractors that differ from the answer and from each other are kept.
    function build({ question, answer, answerNote, wrong, explanation, zh, steps }) {
        const opts = [[answer, answerNote]];
        for (const [v, n] of wrong) {
            if (opts.length === 4) break;
            if (!opts.some(o => o[0] === v)) opts.push([v, n]);
        }
        if (opts.length < 4) throw new Error('not enough distinct options');
        const order = shuffle(opts);
        return {
            question,
            options: order.map(o => o[0]),
            optionNotes: order.map(o => o[1]),
            correct: order.findIndex(o => o[0] === answer),
            explanation,
            explanationZh: zh,
            steps
        };
    }

    const G = {};

    // ── Week 02 Performance ──
    G.transDelay = () => {
        const L = rand(4, 20) * 1000, Rm = pick([10, 100, 1000]), d = L / (Rm * 1e6);
        return build({
            question: `A router sends a packet of L = ${L.toLocaleString('en')} bits onto a link with transmission rate R = ${Rm} Mbps. What is the transmission delay, in seconds?`,
            answer: sci(d), answerNote: `${L} / ${Rm}×10^6 = ${sci(d)} s.`,
            wrong: [
                [sci(d * 10), `Off by 10×: as if the link were ${Rm / 10} Mbps.`],
                [sci(d / 10), `Off by 10×: as if the link were ${Rm * 10} Mbps.`],
                [sci(d * 8), 'Multiplies by 8 again; L is already in bits.'],
                [sci(d / 1000), 'Treats Mbps as 10^9 bit/s.']
            ],
            explanation: `Transmission delay = L/R = ${L} / ${Rm}×10^6 = ${sci(d)} s.`,
            zh: `传输时延 = 包长 / 链路速率 = ${L} bit ÷ ${Rm}×10⁶ bit/s = ${sci(d)} s。注意 Mbps 是 10⁶ bit/s。`,
            steps: ['$d_{trans} = L/R$', `$= ${L} / (${Rm}\\times10^6) = ${tex(d)}\\text{ s}$`]
        });
    };

    G.pktRate = () => {
        const L = rand(4, 20) * 1000, Rm = pick([10, 100, 1000]), n = Math.floor(Rm * 1e6 / L);
        return build({
            question: `A ${Rm} Mbps link carries packets that are all ${L.toLocaleString('en')} bits long. What is the most packets per second the link can carry (rounded down)?`,
            answer: String(n), answerNote: `${Rm}×10^6 / ${L} ≈ ${n}.`,
            wrong: [
                [String(Math.floor(n / 10)), 'This would be a link 10× slower.'],
                [String(Math.floor(Rm * 1e7 / L)), 'This would be a link 10× faster.'],
                [String(Math.floor(Rm * 1e6 / (L * 8))), 'Multiplies L by 8 again; it is already in bits.'],
                [num(L / Rm, 0), 'This is L/R in microseconds, not a packet rate.']
            ],
            explanation: `Packets per second = R/L = ${Rm}×10^6 / ${L} ≈ ${n}.`,
            zh: `每秒最多发 R/L 个包 = ${Rm}×10⁶ / ${L} ≈ ${n} 个，也就是 1 ÷ 传输时延。`,
            steps: ['$\\text{pkts/s} = R/L = 1/d_{trans}$', `$= ${Rm}\\times10^6 / ${L} \\approx ${n}$`]
        });
    };

    G.storeForward = () => {
        const N = rand(2, 4), L = pick([8000, 10000, 12000, 20000]), Rm = pick([4, 8, 10]), p = rand(1, 5);
        const t = L / (Rm * 1000), total = N * (t + p);
        const ms = x => `${num(x)} ms`;
        return build({
            question: `A packet of ${L.toLocaleString('en')} bits crosses ${N} links in series (${N - 1} store-and-forward router${N > 2 ? 's' : ''} in between). Every link is ${Rm} Mbps with a ${p} ms propagation delay. Ignore queuing and processing. What is the end-to-end delay?`,
            answer: ms(total), answerNote: `${N} × (${num(t)} + ${p}) = ${ms(total)}.`,
            wrong: [
                [ms(t + N * p), 'Counts the transmission delay only once; store-and-forward retransmits on every link.'],
                [ms(N * p), 'Propagation only; forgets the transmission delay.'],
                [ms(N * t), 'Transmission only; forgets propagation.'],
                [ms((N - 1) * (t + p)), 'Counts routers instead of links.'],
                [ms((N + 1) * (t + p)), 'Counts one link too many.'],
                [ms(N * (2 * t + p)), 'Counts each transmission twice.']
            ],
            explanation: `Each link adds its own transmission delay L/R = ${num(t)} ms plus ${p} ms propagation, because a store-and-forward router must receive the whole packet before sending it on. ${N} × (${num(t)} + ${p}) = ${ms(total)}.`,
            zh: `存储转发：每一跳都要把整个包重新发一遍，所以每条链路都有 ${num(t)} ms 传输 + ${p} ms 传播，${N} 条链路共 ${ms(total)}。`,
            steps: [`$d_{trans} = L/R = ${L}/(${Rm}\\times10^6) = ${num(t)}\\text{ ms}$`, `Per link: $${num(t)} + ${p} = ${num(t + p)}\\text{ ms}$`, `$${N} \\times ${num(t + p)} = ${num(total)}\\text{ ms}$`]
        });
    };

    G.queuing = () => {
        const k = rand(1, 5), done = pick([0.25, 0.5, 0.75]), Lb = pick([500, 1000, 1500]), Rm = pick([2, 4, 8]);
        const t = Lb * 8 / (Rm * 1000), ans = k * t + (1 - done) * t;
        const ms = x => `${num(x, 3)} ms`;
        return build({
            question: `A packet arrives at a router's output queue. ${k} packet${k > 1 ? 's are' : ' is'} already waiting, and another packet has ${done * 100}% of its bits already transmitted. All packets are ${Lb} bytes and the link is ${Rm} Mbps. How long does the arriving packet wait before its own transmission starts?`,
            answer: ms(ans), answerNote: `${num(1 - done)} × ${num(t, 3)} + ${k} × ${num(t, 3)} = ${ms(ans)}.`,
            wrong: [
                [ms((k + 1) * t), 'Counts the partly sent packet as a full one.'],
                [ms(k * t), 'Ignores the packet currently being transmitted.'],
                [ms(k * t + done * t), 'Uses the part already sent instead of the part still to send.'],
                [ms(ans + t), "Also counts the arriving packet's own transmission, which is not queuing delay."],
                [ms(ans / 8), 'Forgets to convert bytes to bits.']
            ],
            explanation: `Each packet takes ${Lb}×8 / ${Rm}×10^6 = ${num(t, 3)} ms. The arriving packet waits for the rest of the current packet (${num((1 - done) * t, 3)} ms) plus the ${k} queued one${k > 1 ? 's' : ''} (${num(k * t, 3)} ms): ${ms(ans)}.`,
            zh: `排队时延 = 正在发的包剩下的 ${(1 - done) * 100}% (${num((1 - done) * t, 3)} ms) + 前面排队的 ${k} 个包 (${num(k * t, 3)} ms) = ${ms(ans)}。别忘了字节要乘 8。`,
            steps: [`$d_{trans} = ${Lb}\\times8 / (${Rm}\\times10^6) = ${num(t, 3)}\\text{ ms}$`, `Rest of current packet: $${num(1 - done)} \\times ${num(t, 3)} = ${num((1 - done) * t, 3)}\\text{ ms}$`, `Queued: $${k} \\times ${num(t, 3)} = ${num(k * t, 3)}\\text{ ms}$`, `Queuing delay $= ${num(ans, 3)}\\text{ ms}$`]
        });
    };

    G.trafficIntensity = () => {
        const Lb = pick([500, 1000, 1250, 1500]), Rm = pick([1, 2, 5, 10, 20]), a = pick([100, 200, 250, 400, 500, 800, 1000]);
        const rho = Lb * 8 * a / (Rm * 1e6);
        const verdict = rho > 1 ? 'Above 1, packets arrive faster than they can leave, so the queue grows without bound.'
            : rho === 1 ? 'Exactly 1: the queue is unstable and delay grows without bound.'
            : 'Below 1 the queue stays bounded on average, but delay grows sharply as it approaches 1.';
        return build({
            question: `Packets of ${Lb} bytes arrive at a ${Rm} Mbps link at an average rate of ${a} packets per second. What is the traffic intensity La/R?`,
            answer: num(rho, 3), answerNote: `${Lb * 8} × ${a} / ${Rm}×10^6 = ${num(rho, 3)}.`,
            wrong: [
                [num(1 / rho, 3), 'This is R/(La), the inverse.'],
                [num(rho / 8, 3), 'Uses bytes instead of bits for L.'],
                [num(rho * 10, 3), 'Off by 10× in the link rate.'],
                [num(rho / 10, 3), 'Off by 10× in the link rate.']
            ],
            explanation: `La/R = ${Lb * 8} × ${a} / ${Rm}×10^6 = ${num(rho, 3)}. ${verdict}`,
            zh: `流量强度 La/R = ${Lb * 8}×${a} / ${Rm}×10⁶ = ${num(rho, 3)}。${rho >= 1 ? '≥ 1，队列会无限增长。' : '< 1，队列有界；越接近 1 排队时延越大。'}`,
            steps: [`$L = ${Lb} \\times 8 = ${Lb * 8}$ bits`, `$La = ${Lb * 8} \\times ${a} = ${tex(Lb * 8 * a)}$ bit/s`, `$La/R = ${num(rho, 3)}$`]
        });
    };

    G.throughput = () => {
        const rates = shuffle([1, 2, 4, 5, 8, 10, 20, 50]).slice(0, 3), F = pick([2, 4, 5, 8, 10, 20]);
        const min = Math.min(...rates), max = Math.max(...rates), sum = rates.reduce((x, y) => x + y, 0);
        const s = x => `${num(x)} s`;
        return build({
            question: `A server sends a ${F} MB file to a client over a path of three links with rates ${rates[0]} Mbps, ${rates[1]} Mbps and ${rates[2]} Mbps. Ignoring all delays except the bottleneck, roughly how long does the transfer take? (1 MB = 10^6 bytes)`,
            answer: s(F * 8 / min), answerNote: `Bottleneck ${min} Mbps: ${F * 8} Mb / ${min} Mbps = ${s(F * 8 / min)}.`,
            wrong: [
                [s(F * 8 / max), 'Uses the fastest link, which is not the bottleneck.'],
                [s(F * 8 / sum), 'Adds the rates; throughput is a minimum, not a sum.'],
                [s(F / min), 'Forgets that 1 byte = 8 bits.'],
                [s(F * 8 / rates[0]), 'Uses the first link rather than the slowest one.'],
                [s(F * 8 * 3 / sum), 'Uses the average link rate.'],
                [s(F / max), 'Forgets ×8 and uses the fastest link.']
            ],
            explanation: `End-to-end throughput is the minimum link rate, ${min} Mbps. ${F} MB = ${F * 8} Mb, so ${F * 8} / ${min} = ${s(F * 8 / min)}.`,
            zh: `端到端吞吐量 = 最慢那条链路 = ${min} Mbps；${F} MB = ${F * 8} Mb，${F * 8}/${min} = ${s(F * 8 / min)}。`,
            steps: [`$F = ${F}\\text{ MB} = ${F * 8}\\text{ Mb}$`, `$R_{e2e} = \\min(${rates.join(', ')}) = ${min}\\text{ Mbps}$`, `$T = F / R_{e2e} = ${num(F * 8 / min)}\\text{ s}$`]
        });
    };

    G.circuitUsers = () => {
        const link = pick([1, 2, 5, 10, 20, 100]), user = pick([100, 200, 250, 500]), pct = pick([5, 10, 20]);
        const N = link * 1000 / user;
        return build({
            question: `A ${link} Mbps link is shared by users who each need ${user} kbps while active and are active only ${pct}% of the time. With circuit switching (a reserved ${user} kbps per user), how many users can the link support?`,
            answer: num(N), answerNote: `${link * 1000} / ${user} = ${num(N)}.`,
            wrong: [
                [num(N * 100 / pct), 'Divides by the average rate; that is the packet-switching intuition, not circuit switching.'],
                [num(N / 1000, 3), 'Mixes up kbps and Mbps.'],
                [num(N * pct / 100), 'Applies the activity percentage; circuit switching reserves the peak rate regardless.'],
                [num(N * 2), 'Arithmetic slip: doubled.']
            ],
            explanation: `Circuit switching reserves the peak rate for every user whether active or not: ${link} Mbps / ${user} kbps = ${num(N)} users. Packet switching could admit more, because users are rarely active at the same time.`,
            zh: `电路交换按峰值预留带宽：${link} Mbps / ${user} kbps = ${num(N)} 人，与活跃比例无关；分组交换利用统计复用可以容纳更多人。`,
            steps: ['Circuit switching reserves peak rate per user', `$N = ${link}\\text{ Mbps} / ${user}\\text{ kbps} = ${num(N)}$`]
        });
    };

    G.bdp = () => {
        const Rm = pick([10, 100, 1000]), km = pick([100, 500, 1000, 3000, 6000, 10000]);
        const prop = km * 1e3 / 2e8, bdp = Rm * 1e6 * prop;
        return build({
            question: `A ${Rm} Mbps link is ${km} km long with propagation speed 2×10^8 m/s. What is its bandwidth-delay product (the number of bits 'in flight' on the link)?`,
            answer: sci(bdp), answerNote: `${Rm}×10^6 × ${num(prop * 1000, 3)} ms = ${sci(bdp)} bits.`,
            wrong: [
                [sci(bdp * 10), 'Off by 10×.'],
                [sci(bdp / 10), 'Off by 10×.'],
                [sci(bdp / 8), 'Converts to bytes; the question asks for bits.'],
                [sci(Rm * 1e6 * km * 1e3 / 3e8), 'Uses 3×10^8 m/s instead of the given 2×10^8 m/s.']
            ],
            explanation: `d_prop = ${km}×10^3 / 2×10^8 = ${num(prop * 1000, 3)} ms. R × d_prop = ${Rm}×10^6 × ${sci(prop)} = ${sci(bdp)} bits.`,
            zh: `带宽时延积 = R × 传播时延 = ${Rm}×10⁶ × ${sci(prop)} s = ${sci(bdp)} bit，表示链路上同时“在路上”的比特数。`,
            steps: [`$d_{prop} = ${km}\\times10^3 / (2\\times10^8) = ${tex(prop)}\\text{ s}$`, `$R \\cdot d_{prop} = ${Rm}\\times10^6 \\times ${tex(prop)} = ${tex(bdp)}$ bits`]
        });
    };

    // ── Week 03 Applications ──
    G.httpNonPersistent = () => {
        const n = rand(2, 10), rtt = rand(1, 10) * 5, ms = x => `${x} ms`;
        return build({
            question: `A web page has a base HTML file and ${n} small referenced images (transmission time negligible). RTT to the server is ${rtt} ms. With non-persistent HTTP and no parallel connections, how long until all objects are received?`,
            answer: ms(2 * (n + 1) * rtt), answerNote: `${n + 1} × 2 RTT = ${2 * (n + 1)} × ${rtt} = ${ms(2 * (n + 1) * rtt)}.`,
            wrong: [
                [ms((2 + n) * rtt), `Persistent without pipelining: 2 RTT + ${n} × 1 RTT.`],
                [ms(4 * rtt), `Non-persistent with ${n} parallel connections: 2 RTT + 2 RTT.`],
                [ms(3 * rtt), 'Persistent with pipelining: 2 RTT + 1 RTT.'],
                [ms((n + 1) * rtt), 'Forgets the TCP handshake for each object.'],
                [ms(2 * n * rtt), 'Forgets the base HTML file.'],
                [ms(2 * (n + 2) * rtt), 'Counts one object too many.']
            ],
            explanation: `Non-persistent HTTP needs 2 RTT per object (TCP handshake + request/response). ${n + 1} objects × 2 RTT = ${2 * (n + 1)} RTT = ${ms(2 * (n + 1) * rtt)}.`,
            zh: `非持久 HTTP 每个对象都要 2 RTT（建连 + 请求响应），${n + 1} 个对象串行 = ${2 * (n + 1)} RTT = ${ms(2 * (n + 1) * rtt)}。`,
            steps: ['Base page: $2\\,RTT$ (handshake + GET)', 'Each image also needs its own connection: $2\\,RTT$', `$${n + 1} \\times 2\\,RTT = ${2 * (n + 1)} \\times ${rtt} = ${2 * (n + 1) * rtt}\\text{ ms}$`]
        });
    };

    G.httpPipelined = () => {
        const n = rand(2, 10), rtt = rand(1, 10) * 5, ms = x => `${x} ms`;
        return build({
            question: `A web page has a base HTML file and ${n} small images; RTT is ${rtt} ms. HTTP is persistent with pipelining: all ${n} image requests go out back-to-back on the open connection. How long until all objects are received?`,
            answer: ms(3 * rtt), answerNote: `2 RTT + 1 RTT = 3 × ${rtt} = ${ms(3 * rtt)}.`,
            wrong: [
                [ms(4 * rtt), 'That is non-persistent with parallel connections (4 RTT).'],
                [ms((2 + n) * rtt), `That is persistent without pipelining (${2 + n} RTT).`],
                [ms(2 * rtt), 'Forgets the round trip for the pipelined image requests.'],
                [ms(2 * (n + 1) * rtt), 'That is non-persistent, one object at a time.']
            ],
            explanation: `2 RTT for the handshake and the base file, then one more RTT for all pipelined image requests: 3 RTT = ${ms(3 * rtt)}.`,
            zh: `持久 + 流水线：2 RTT 拿到 base 文件，之后 ${n} 个请求一起发，再 1 RTT 全部回来，共 3 RTT = ${ms(3 * rtt)}。`,
            steps: ['Handshake + base file: $2\\,RTT$', `All ${n} requests pipelined: $+1\\,RTT$`, `$3 \\times ${rtt} = ${3 * rtt}\\text{ ms}$`]
        });
    };

    G.dnsHttp = () => {
        const d = [rand(1, 10) * 5, rand(1, 10) * 5, rand(1, 10) * 5], r0 = rand(2, 10) * 10;
        const dns = d[0] + d[1] + d[2], ms = x => `${x} ms`;
        return build({
            question: `A host's DNS cache is empty. Resolving a hostname visits three DNS servers one after another with RTTs of ${d[0]} ms, ${d[1]} ms and ${d[2]} ms. The web server's RTT is ${r0} ms, the page has no embedded objects, and HTTP is non-persistent. How long from the click until the page is received?`,
            answer: ms(dns + 2 * r0), answerNote: `${dns} ms DNS + 2 × ${r0} ms = ${ms(dns + 2 * r0)}.`,
            wrong: [
                [ms(dns + r0), 'Only one RTT to the web server; TCP setup is missing.'],
                [ms(dns + 3 * r0), 'Three RTTs to the web server.'],
                [ms(2 * r0), 'Forgets the DNS lookup.'],
                [ms(Math.max(...d) + 2 * r0), 'Counts only the slowest DNS server; the lookups happen one after another.']
            ],
            explanation: `DNS: ${d.join(' + ')} = ${dns} ms. Then 2 RTT to the web server (TCP setup + GET) = ${2 * r0} ms. Total ${ms(dns + 2 * r0)}.`,
            zh: `先做 DNS：${d.join('+')} = ${dns} ms；再 TCP 握手 + HTTP 请求各 1 个 RTT：2×${r0} = ${2 * r0} ms；合计 ${ms(dns + 2 * r0)}。`,
            steps: [`$T_{DNS} = ${d.join(' + ')} = ${dns}\\text{ ms}$`, `$T_{HTTP} = 2\\,RTT_0 = ${2 * r0}\\text{ ms}$`, `Total $= ${dns + 2 * r0}\\text{ ms}$`]
        });
    };

    // ── Week 04 DNS & P2P ──
    G.dnsMessages = () => {
        const chain = pick([['root', 'TLD', 'authoritative'], ['root', 'TLD', 'intermediate', 'authoritative']]);
        const k = chain.length, total = 2 + 2 * k;
        return build({
            question: `A host asks its local DNS server for a name the local server has not cached. The local server then queries the ${chain.slice(0, -1).join(', ')} and ${chain[k - 1]} servers iteratively. Counting every query and every reply, how many DNS messages are exchanged in total?`,
            answer: String(total), answerNote: `2 + ${k} × 2 = ${total}.`,
            wrong: [
                [String(2 * k), 'Forgets the host ↔ local DNS exchange.'],
                [String(1 + k), 'Counts only the queries, not the replies.'],
                [String(total + 2), 'Adds a server that is not contacted.'],
                [String(k), 'Counts servers, not messages.']
            ],
            explanation: `Host↔local (2) plus a query and reply with each of the ${k} servers (${2 * k}): ${total} messages.`,
            zh: `主机↔本地 DNS 一问一答 2 条；本地 DNS 依次问 ${k} 个服务器，各一问一答共 ${2 * k} 条；合计 ${total} 条。`,
            steps: ['Host → local, local → host: 2', `${chain.join(', ')}: $${k} \\times 2 = ${2 * k}$`, `Total $= ${total}$`]
        });
    };

    function p2pParams() {
        const F = pick([0.5, 1, 2]) * 1000, N = rand(5, 30), us = pick([10, 20, 30, 50]), d = pick([2, 5, 10, 20]), u = pick([0.5, 1, 2]);
        return {
            F, N, us, d, u,
            cs: Math.max(N * F / us, F / d),
            p2p: Math.max(F / us, F / d, N * F / (us + N * u)),
            text: `A ${num(F / 1000)} Gbit file goes to N = ${N} peers. The server upload rate is ${us} Mbps, every peer downloads at ${d} Mbps and uploads at ${u} Mbps.`
        };
    }

    G.distCS = () => {
        const p = p2pParams(), s = x => `${num(x, 1)} s`;
        return build({
            question: `${p.text} What is the minimum distribution time with client-server distribution?`,
            answer: s(p.cs), answerNote: `max(${num(p.N * p.F / p.us, 1)}, ${num(p.F / p.d, 1)}) = ${s(p.cs)}.`,
            wrong: [
                [s(p.p2p), 'That is the P2P bound for the same numbers.'],
                [s(p.F / p.d), 'This is only F/d_min, the download bound.'],
                [s(p.F / p.us), 'This is F/u_s, one copy from the server.'],
                [s(p.N * p.F / p.d), 'Multiplies the download bound by N; each peer downloads in parallel.'],
                [s(p.cs * 2), 'Arithmetic slip: doubled.']
            ],
            explanation: `D_cs = max(NF/u_s, F/d_min) = max(${num(p.N * p.F / p.us, 1)}, ${num(p.F / p.d, 1)}) = ${s(p.cs)}.`,
            zh: `客户端-服务器：服务器要上传 N 份，NF/u_s = ${num(p.N * p.F / p.us, 1)} s；最慢的下载 F/d_min = ${num(p.F / p.d, 1)} s；取较大者 ${s(p.cs)}。`,
            steps: ['$D_{cs} = \\max(NF/u_s,\\ F/d_{min})$', `$NF/u_s = ${p.N}\\times${p.F}/${p.us} = ${num(p.N * p.F / p.us, 1)}$`, `$F/d_{min} = ${p.F}/${p.d} = ${num(p.F / p.d, 1)}$`, `$D_{cs} = ${num(p.cs, 1)}\\text{ s}$`]
        });
    };

    G.distP2P = () => {
        const p = p2pParams(), s = x => `${num(x, 1)} s`, agg = p.N * p.F / (p.us + p.N * p.u);
        return build({
            question: `${p.text} What is the minimum distribution time with P2P distribution?`,
            answer: s(p.p2p), answerNote: `max(${num(p.F / p.us, 1)}, ${num(p.F / p.d, 1)}, ${num(agg, 1)}) = ${s(p.p2p)}.`,
            wrong: [
                [s(p.cs), 'That is the client-server time.'],
                [s(p.F / p.us), "Only the server's single upload."],
                [s(p.F / p.d), 'Only the download bound.'],
                [s(agg), 'Only the aggregate-upload bound; it is not the largest here.'],
                [s(p.N * p.F / (p.N * p.u)), "Leaves out the server's upload capacity."],
                [s(p.p2p * 2), 'Arithmetic slip: doubled.'],
                [s(p.p2p / 2), 'Arithmetic slip: halved.']
            ],
            explanation: `D_p2p = max(F/u_s, F/d_min, NF/(u_s + Σu_i)) = max(${num(p.F / p.us, 1)}, ${num(p.F / p.d, 1)}, ${num(agg, 1)}) = ${s(p.p2p)}.`,
            zh: `P2P 下界取三项最大：F/u_s = ${num(p.F / p.us, 1)}，F/d_min = ${num(p.F / p.d, 1)}，NF/(u_s+Nu) = ${num(agg, 1)}；所以是 ${s(p.p2p)}。`,
            steps: ['$D_{P2P} = \\max(F/u_s,\\ F/d_{min},\\ NF/(u_s+\\sum u_i))$', `$F/u_s = ${num(p.F / p.us, 1)}$, $F/d_{min} = ${num(p.F / p.d, 1)}$`, `$NF/(u_s+Nu) = ${p.N * p.F}/${num(p.us + p.N * p.u)} = ${num(agg, 1)}$`, `$D_{P2P} = ${num(p.p2p, 1)}\\text{ s}$`]
        });
    };

    // ── Week 05 Transport ──
    G.checksum = () => {
        const words = [rand(0x1000, 0xFFFF), rand(0x1000, 0xFFFF), rand(0x1000, 0xFFFF)];
        const steps = [];
        let s = 0, raw = 0;
        words.forEach((w, i) => {
            raw += w;
            const prev = s, before = s + w;
            s = (before & 0xFFFF) + (before >> 16);
            if (!i) return;
            steps.push(before > 0xFFFF
                ? `$${hex(prev)} + ${hex(w)} = \\text{0x${before.toString(16).toUpperCase()}}$, wrap carry → $${hex(s)}$`
                : `$${hex(prev)} + ${hex(w)} = ${hex(s)}$`);
        });
        const ck = ~s & 0xFFFF;
        return build({
            question: `Compute the Internet checksum of the three 16-bit words ${words.map(hex).join(', ')}.`,
            answer: hex(ck), answerNote: `~${hex(s)} = ${hex(ck)}.`,
            wrong: [
                [hex(s), 'This is the wrapped sum before taking the complement.'],
                [hex(~(raw & 0xFFFF)), 'Drops the carries instead of adding them back, then complements.'],
                [hex(raw & 0xFFFF), 'Drops the carries and skips the complement.'],
                [hex((~s + 1) & 0xFFFF), "Two's complement; the Internet checksum uses one's complement."],
                [hex(ck ^ 1), 'Off in the lowest bit: an end-around carry was added once too often or too few.'],
                [hex(((ck & 0xFF) << 8) | (ck >> 8)), 'Swaps the two bytes.']
            ],
            explanation: `Add the words with end-around carry (any carry out of bit 15 is added back in) to get ${hex(s)}. The checksum is its one's complement: ${hex(ck)}.`,
            zh: `16 位反码求和：溢出的进位要加回最低位，得到 ${hex(s)}，最后按位取反得到校验和 ${hex(ck)}。`,
            steps: [...steps, `One's complement: $\\sim ${hex(s)} = ${hex(ck)}$`]
        });
    };

    G.stopAndWait = () => {
        const Lb = pick([1000, 1500]), Rm = pick([10, 100, 1000]), rtt = pick([10, 20, 30, 50, 100]);
        const dt = Lb * 8 / (Rm * 1e6), U = dt / (rtt / 1000 + dt);
        return build({
            question: `A stop-and-wait sender sends ${Lb}-byte packets over a ${Rm} Mbps link with RTT = ${rtt} ms. What is the sender utilisation (fraction of time it is actually sending)?`,
            answer: sci(U), answerNote: `${sci(dt)} / (${rtt}×10^-3 + ${sci(dt)}) = ${sci(U)}.`,
            wrong: [
                [sci(U * 100), 'As if 100 packets were pipelined per RTT.'],
                [sci(dt), 'That is L/R in seconds, not a fraction.'],
                [sci(U / 8), 'Forgets to convert bytes to bits.'],
                [sci(dt / (2 * rtt / 1000 + dt)), 'Doubles the RTT; RTT already covers the round trip.']
            ],
            explanation: `d_trans = ${Lb}×8 / ${Rm}×10^6 = ${sci(dt)} s. U = d_trans / (RTT + d_trans) = ${sci(U)}.`,
            zh: `停等协议每个 RTT 只能发一个包：U = (L/R)/(RTT + L/R) = ${sci(dt)} / (${rtt} ms + ${sci(dt)} s) ≈ ${sci(U)}，所以需要流水线。`,
            steps: [`$d_{trans} = L/R = ${Lb * 8}/(${Rm}\\times10^6) = ${tex(dt)}\\text{ s}$`, '$U = d_{trans}/(RTT + d_{trans})$', `$= ${tex(U)}$`]
        });
    };

    // ── Week 06 TCP ──
    G.tcpTimeout = () => {
        const est = rand(8, 20) * 10;
        let sample = est + rand(-4, 8) * 10;
        if (sample === est) sample += 20;
        const dev = rand(1, 6) * 5, est2 = 0.875 * est + 0.125 * sample, to = est2 + 4 * dev, ms = x => `${num(x)} ms`;
        return build({
            question: `TCP has EstimatedRTT = ${est} ms when a new SampleRTT of ${sample} ms arrives (α = 0.125). After the update DevRTT is ${dev} ms. What is the new TimeoutInterval?`,
            answer: ms(to), answerNote: `${num(est2)} + 4 × ${dev} = ${ms(to)}.`,
            wrong: [
                [ms(est2), 'EstimatedRTT alone, no safety margin.'],
                [ms(est + 4 * dev), 'Uses the old EstimatedRTT.'],
                [ms(est2 + dev), 'Adds 1 × DevRTT; the rule is 4 × DevRTT.'],
                [ms(sample + 4 * dev), 'Uses SampleRTT instead of the smoothed EstimatedRTT.']
            ],
            explanation: `EstimatedRTT = 0.875×${est} + 0.125×${sample} = ${num(est2)} ms. TimeoutInterval = EstimatedRTT + 4×DevRTT = ${num(est2)} + ${4 * dev} = ${ms(to)}.`,
            zh: `先更新 EstimatedRTT = 0.875×${est} + 0.125×${sample} = ${num(est2)} ms，再加 4 倍 DevRTT：${num(est2)} + ${4 * dev} = ${ms(to)}。`,
            steps: [`$EstRTT = 0.875\\cdot${est} + 0.125\\cdot${sample} = ${num(est2)}$`, '$Timeout = EstRTT + 4\\cdot DevRTT$', `$= ${num(est2)} + ${4 * dev} = ${num(to)}\\text{ ms}$`]
        });
    };

    G.tcpAckLoss = () => {
        const s1 = rand(1, 50) * 10, l1 = rand(5, 20) * 10, l2 = rand(5, 20) * 10, l3 = rand(5, 20) * 10;
        const s2 = s1 + l1, s3 = s2 + l2, end = s3 + l3;
        return build({
            question: `Host A sends three TCP segments back-to-back: seq ${s1} (${l1} bytes), seq ${s2} (${l2} bytes) and seq ${s3} (${l3} bytes). The second segment is lost. What acknowledgement number does B send when the third segment arrives?`,
            answer: String(s2), answerNote: `Still waiting for byte ${s2}.`,
            wrong: [
                [String(end), `${end} is the next byte after the third segment; it would mean nothing is missing.`],
                [String(s3), "That is the third segment's own sequence number."],
                [String(s1), 'That segment was already received and acknowledged.'],
                [String(s3 + l3 - l2), 'Skips over the gap; TCP ACKs are cumulative.']
            ],
            explanation: `TCP ACKs are cumulative: B still needs byte ${s2}, so it repeats ACK ${s2} (a duplicate ACK) even though bytes ${s3}–${end - 1} arrived.`,
            zh: `TCP 累计确认：ACK 号 = 下一个期望的字节。第二段丢了，B 仍在等 ${s2}，所以收到第三段时回的还是 ACK ${s2}（重复 ACK）。`,
            steps: [`Seg 1 arrives → ACK ${s2}`, `Seg 2 (seq ${s2}) lost`, `Seg 3 (seq ${s3}) arrives out of order → ACK ${s2} again`]
        });
    };

    G.cwnd = () => {
        const ss = pick([4, 8, 16, 32]), ssRtts = Math.log2(ss), n = rand(ssRtts + 1, ssRtts + 4);
        let cw = 1;
        const trace = [1];
        for (let i = 0; i < n; i++) { cw = cw < ss ? cw * 2 : cw + 1; trace.push(cw); }
        const m = x => `${x} MSS`;
        return build({
            question: `A TCP connection starts in slow start with cwnd = 1 MSS and ssthresh = ${ss} MSS. No loss occurs. What is cwnd after ${n} RTTs?`,
            answer: m(cw), answerNote: `${ss} after ${ssRtts} RTTs, then +1 per RTT: ${cw}.`,
            wrong: [
                [m(2 ** n), 'Keeps doubling past ssthresh.'],
                [m(cw - 1), 'Off by one RTT.'],
                [m(cw + 1), 'Off by one RTT.'],
                [m(ss), 'Stops growing at ssthresh; congestion avoidance still adds 1 MSS per RTT.']
            ],
            explanation: `Slow start doubles each RTT until ssthresh: ${trace.slice(0, ssRtts + 1).join(' → ')} (${ssRtts} RTTs). Then congestion avoidance adds 1 MSS per RTT: ${trace.slice(ssRtts).join(' → ')}.`,
            zh: `慢启动每 RTT 翻倍：${trace.slice(0, ssRtts + 1).join('→')}（${ssRtts} 个 RTT）；到达 ssthresh 后改为拥塞避免每 RTT +1：${trace.slice(ssRtts).join('→')}。`,
            steps: [`RTT 1–${ssRtts}: $${trace.slice(0, ssRtts + 1).join('\\to')}$`, 'cwnd = ssthresh → congestion avoidance', `RTT ${ssRtts + 1}–${n}: $${trace.slice(ssRtts).join('\\to')}$`]
        });
    };

    G.renoTimeout = () => {
        const cw = rand(4, 20) * 2, h = cw / 2;
        return build({
            question: `TCP Reno has cwnd = ${cw} MSS when a timeout occurs. What are ssthresh and cwnd right afterwards?`,
            answer: `ssthresh = ${h}, cwnd = 1`, answerNote: 'Timeout → ssthresh = cwnd/2, cwnd = 1.',
            wrong: [
                [`ssthresh = ${h}, cwnd = ${h + 3}`, "That is Reno's response to a triple duplicate ACK."],
                [`ssthresh = ${cw}, cwnd = 1`, 'ssthresh should be halved.'],
                [`ssthresh = ${h}, cwnd = ${h}`, 'Halving cwnd without resetting it is not what a timeout does.']
            ],
            explanation: `On a timeout both Tahoe and Reno set ssthresh = cwnd/2 = ${h} and restart slow start at cwnd = 1 MSS. The 'halve and add 3' fast-recovery rule is for triple duplicate ACKs.`,
            zh: `超时：ssthresh = cwnd/2 = ${h}，cwnd 回到 1 MSS 重新慢启动。三个重复 ACK 才是 Reno 的快速恢复（cwnd = ${h} + 3 = ${h + 3}）。`,
            steps: [`$ssthresh = cwnd/2 = ${h}$`, 'Timeout → $cwnd = 1$ MSS, slow start again']
        });
    };

    // ── Week 10 Wireless ──
    G.cdma = () => {
        const M = pick([4, 8]), code = Array.from({ length: M }, () => pick([1, -1])), bit = pick([1, -1]);
        const rx = code.map(c => c * bit);
        const fmt = v => v.map(minus).join(', ');
        return build({
            question: `A CDMA sender uses the code (${fmt(code)}). In one bit slot the receiver gets the chips (${fmt(rx)}). What data value does it decode?`,
            answer: minus(bit), answerNote: `Σ Z·c / M = ${minus(bit * M)}/${M} = ${minus(bit)}.`,
            wrong: [
                [minus(-bit), 'Sign error.'],
                ['0', 'Zero would mean no signal from this sender.'],
                [minus(bit * M), `Forgot to divide by M = ${M}.`]
            ],
            explanation: `Decode = (1/M) Σ Z_m·c_m = ${minus(bit * M)}/${M} = ${minus(bit)}.`,
            zh: `CDMA 解码：接收码片与自己的码逐位相乘再求和，除以 M = ${M}：${minus(bit * M)}/${M} = ${minus(bit)}。`,
            steps: ['$d = \\frac{1}{M}\\sum_m Z_m c_m$', `$= ${bit * M}/${M} = ${bit}$`]
        });
    };

    // ── Week 01 Collisions ──
    G.aloha = () => {
        const N = rand(3, 8), p = pick([0.1, 0.2, 0.25, 0.3]), ans = p * (1 - p) ** (N - 1), f = x => num(x, 4);
        return build({
            question: `In slotted ALOHA, N = ${N} nodes each transmit in a slot with probability p = ${p}. What is the probability that one particular node succeeds in a given slot?`,
            answer: f(ans), answerNote: `${p} × ${1 - p}^${N - 1} = ${f(ans)}.`,
            wrong: [
                [f(N * ans), 'That is the probability that *any* node succeeds (N times larger).'],
                [f(p), 'Only that it transmits, ignoring collisions.'],
                [f((1 - p) ** (N - 1)), 'Forgets that this node must transmit.'],
                [f(p * (1 - p) ** N), 'Uses N instead of N − 1 other nodes.']
            ],
            explanation: `That node must transmit (p) while the other ${N - 1} stay silent ((1−p)^${N - 1}): ${p} × ${num((1 - p) ** (N - 1), 4)} = ${f(ans)}.`,
            zh: `指定节点成功 = 它发 (p) 且其余 ${N - 1} 个都不发 ((1−p)^${N - 1})：${p} × ${num((1 - p) ** (N - 1), 4)} = ${f(ans)}。任一节点成功再乘 N。`,
            steps: ['$P = p(1-p)^{N-1}$', `$= ${p} \\times ${num(1 - p)}^{${N - 1}} = ${f(ans)}$`]
        });
    };

    window.QUIZ_GENERATORS = G;
})();
