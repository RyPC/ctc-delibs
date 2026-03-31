import Papa from "papaparse";
import { supabase, isSupabaseConfigured } from "../supabaseClient";

const ROLE_KEYS = [
    "What role(s) are you interested in? Please choose up to 2.",
    "What role are you applying for?",
];

function uuidv4() {
    // RFC4122 compliant UUID v4 (no extra dependency)
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const randomByte =
            typeof crypto !== "undefined" &&
            crypto.getRandomValues &&
            typeof Uint8Array !== "undefined"
                ? crypto.getRandomValues(new Uint8Array(1))[0]
                : Math.floor(Math.random() * 256);
        const r = (randomByte & 0xff) / 256;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return Math.floor(v).toString(16);
    });
}

function genUuid() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    return uuidv4();
}

function normalizeRoleName(role) {
    return (role || "").toString().trim();
}

function parseRoleList(value) {
    if (!value) return [];
    return value
        .toString()
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean);
}

function normalizeHeaderCell(cell) {
    return (cell ?? "").toString().trim();
}

function headerEquals(a, b) {
    return normalizeHeaderCell(a).toLowerCase() === normalizeHeaderCell(b).toLowerCase();
}

function findHeaderIndexCaseInsensitive(headerRow, desired) {
    const desiredNorm = normalizeHeaderCell(desired).toLowerCase();
    if (!desiredNorm) return -1;
    for (let i = 0; i < (headerRow || []).length; i++) {
        if (normalizeHeaderCell(headerRow[i]).toLowerCase() === desiredNorm) return i;
    }
    return -1;
}

function findFirstHeaderIndex(headerRow, candidates) {
    for (const c of candidates) {
        const idx = findHeaderIndexCaseInsensitive(headerRow, c);
        if (idx !== -1) return idx;
    }
    return -1;
}

function getCsvLayout(headerRow) {
    // Supports Google Forms exports like:
    // Timestamp, Email Address, Full Name, ...
    // and older format where we assumed Timestamp, Email, ...
    const timestampIdx = findFirstHeaderIndex(headerRow, ["Timestamp"]);
    const emailIdx = findFirstHeaderIndex(headerRow, [
        "Email Address",
        "Email",
        "Email address",
    ]);
    const fullNameIdx = findFirstHeaderIndex(headerRow, ["Full Name", "Name", "Full name"]);

    // Fallbacks to prior assumptions if headers aren't present.
    const resolvedTimestampIdx = timestampIdx !== -1 ? timestampIdx : 0;
    const resolvedEmailIdx = emailIdx !== -1 ? emailIdx : 1;

    const questionIndices = [];
    for (let i = 0; i < (headerRow || []).length; i++) {
        if (i === resolvedTimestampIdx) continue;
        if (i === resolvedEmailIdx) continue;
        questionIndices.push(i);
    }

    return {
        timestampIdx: resolvedTimestampIdx,
        emailIdx: resolvedEmailIdx,
        fullNameIdx,
        questionIndices,
    };
}

function getRoleQuestionKeys(headerKeys) {
    const keys = (headerKeys || []).filter(Boolean);

    const detected = keys.filter((k) => {
        const s = k.toString().toLowerCase();
        return (
            s.includes("what role") &&
            (s.includes("applying") ||
                s.includes("interested") ||
                s.includes("position") ||
                s.includes("roles"))
        );
    });

    // Always include legacy ROLE_KEYS if present verbatim (case-insensitive).
    const legacyPresent = ROLE_KEYS.filter((rk) => findKeyCaseInsensitive(keys, rk));
    const combined = [...new Set([...detected, ...legacyPresent])];
    return combined;
}

function findKeyCaseInsensitive(keys, desiredKey) {
    const desired = (desiredKey || "").toString().trim().toLowerCase();
    if (!desired) return null;
    for (const k of keys || []) {
        if ((k || "").toString().trim().toLowerCase() === desired) return k;
    }
    return null;
}

function ensureUniqueDisplayName(baseName, fallbackToken, used) {
    const cleanBase = (baseName || "").toString().trim();
    const base = cleanBase || (fallbackToken || "").toString().trim() || "Unknown";

    const prev = used.get(base) || 0;
    used.set(base, prev + 1);
    if (prev === 0) return base;

    // If duplicate, prefer appending an identifying token (email), otherwise a counter.
    if (fallbackToken) return `${base} <${fallbackToken}>`;
    return `${base} (${prev + 1})`;
}

function chunkArray(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

function mergeResponseValue(prevValue, nextValue) {
    const prev = prevValue == null ? "" : prevValue.toString();
    const next = nextValue == null ? "" : nextValue.toString();
    if (!prev.trim() && next.trim()) return next;
    return prev;
}

export async function getCurrentDatasetId() {
    if (!isSupabaseConfigured()) return null;
    const { data, error } = await supabase
        .from("datasets")
        .select("id")
        .eq("is_current", true)
        .order("created_at", { ascending: false })
        .limit(1);

    if (error) throw error;
    return data?.[0]?.id ?? null;
}

export async function fetchRolesForDataset(datasetId) {
    if (!isSupabaseConfigured()) return [];
    const { data, error } = await supabase
        .from("roles")
        .select("role_name")
        .eq("dataset_id", datasetId)
        .order("role_name", { ascending: true });
    if (error) throw error;
    return (data || []).map((r) => r.role_name);
}

export async function fetchCandidatesForRole(datasetId, roleName) {
    if (!isSupabaseConfigured()) return [];

    const { data: candidateRows, error: candErr } = await supabase
        .from("applicant_role_candidates")
        .select("applicant_id")
        .eq("dataset_id", datasetId)
        .eq("role_name", roleName);
    if (candErr) throw candErr;

    const applicantIds = (candidateRows || []).map((r) => r.applicant_id);
    if (applicantIds.length === 0) return [];

    const { data: applicants, error: applErr } = await supabase
        .from("applicants")
        .select("id, name")
        .eq("dataset_id", datasetId)
        .in("id", applicantIds);
    if (applErr) throw applErr;

    return (applicants || []).sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchApplicantResponses(applicantId) {
    if (!isSupabaseConfigured()) return [];
    const { data, error } = await supabase
        .from("applicant_responses")
        .select("question_key, response, question_order")
        .eq("applicant_id", applicantId);
    if (error) throw error;

    const rows = (data || []).slice();
    rows.sort((a, b) => {
        const ao = a.question_order;
        const bo = b.question_order;
        if (ao == null && bo == null) return 0;
        if (ao == null) return 1;
        if (bo == null) return -1;
        return ao - bo;
    });

    return rows.map((r) => [r.question_key, r.response]);
}

export async function loadPublishedSelections(datasetId) {
    if (!isSupabaseConfigured()) return new Map();
    const { data, error } = await supabase
        .from("published_selections")
        .select("role_name, applicant_id")
        .eq("dataset_id", datasetId);
    if (error) throw error;

    const out = new Map(); // role_name -> Set(applicant_id)
    (data || []).forEach((row) => {
        const role = row.role_name;
        if (!out.has(role)) out.set(role, new Set());
        out.get(role).add(row.applicant_id);
    });
    return out;
}

export async function publishRoleSelections(datasetId, roleName, applicantIds) {
    if (!isSupabaseConfigured()) throw new Error("Supabase not configured");

    // Replace the role's rows for this dataset.
    const { error: delErr } = await supabase
        .from("published_selections")
        .delete()
        .eq("dataset_id", datasetId)
        .eq("role_name", roleName);
    if (delErr) throw delErr;

    if (!applicantIds || applicantIds.length === 0) return;

    const rows = applicantIds.map((id) => ({
        dataset_id: datasetId,
        role_name: roleName,
        applicant_id: id,
    }));
    const { error: insErr } = await supabase.from("published_selections").insert(rows);
    if (insErr) throw insErr;
}

export async function importCsvAsNewCurrentDataset(files) {
    if (!isSupabaseConfigured()) throw new Error("Supabase not configured");

    const fileList = Array.isArray(files) ? files : [files].filter(Boolean);
    if (fileList.length === 0) throw new Error("No CSV files provided");
    if (fileList.length > 2) throw new Error("Please upload at most 2 CSV files");

    const datasetId = genUuid();

    // Build applicants + derived role candidates
    const rolesSet = new Set();
    const applicants = [];
    const usedDisplayNames = new Map(); // display_name -> count (for uniqueness)
    const applicantIdByEmail = new Map(); // email -> applicant_id
    const emailByApplicantId = new Map(); // applicant_id -> email (for name disambiguation)

    // Merge responses in-memory first: applicant_id -> Map(question_key -> {order,value})
    const responsesByApplicant = new Map();
    const orderByQuestionKey = new Map(); // question_key -> first seen order

    // Candidate role rows merged: `${role_name}:${applicant_id}`
    const candidateKeySet = new Set();

    for (const file of fileList) {
        const csvText = await file.text();
        const parsed = Papa.parse(csvText, {
            header: false,
            skipEmptyLines: true,
        });

        const parsedData = parsed?.data || [];
        if (parsedData.length < 2) continue;

        const headerRow = parsedData[0] || [];
        const layout = getCsvLayout(headerRow);
        const headerKeys = layout.questionIndices
            .map((i) => normalizeHeaderCell(headerRow[i]))
            .filter(Boolean);
        const fullNameKey = findKeyCaseInsensitive(headerKeys, "Full Name");
        const roleQuestionKeys = getRoleQuestionKeys(headerKeys);

        parsedData.slice(1).forEach((row) => {
            const email = row?.[layout.emailIdx]?.toString()?.trim();
            if (!email) return;

            let applicantId = applicantIdByEmail.get(email);
            if (!applicantId) {
                applicantId = genUuid();
                applicantIdByEmail.set(email, applicantId);
                emailByApplicantId.set(applicantId, email);
            }

            const infoByKey = new Map();
            layout.questionIndices.forEach((colIdx, qIdx) => {
                const key = normalizeHeaderCell(headerRow[colIdx]);
                if (!key) return;
                const val = row?.[colIdx];
                if (val === undefined || val === null) return;
                infoByKey.set(key, val.toString());
                if (!orderByQuestionKey.has(key)) orderByQuestionKey.set(key, qIdx);
            });

            // Set applicant display name once (or keep the existing if full name missing).
            if (!responsesByApplicant.has(applicantId)) {
                responsesByApplicant.set(applicantId, new Map());
            }

            // Derived roles set
            roleQuestionKeys.forEach((roleKey) => {
                if (!infoByKey.has(roleKey)) return;
                const raw = infoByKey.get(roleKey);
                const selectedRoles = parseRoleList(raw);
                selectedRoles.forEach((r) => rolesSet.add(normalizeRoleName(r)));
            });

            // Candidate roles (union of all detected role columns)
            const candidateRoles = new Set();
            roleQuestionKeys.forEach((roleKey) => {
                const roleList = parseRoleList(infoByKey.get(roleKey));
                roleList.forEach((r) => candidateRoles.add(normalizeRoleName(r)));
            });
            candidateRoles.forEach((roleName) => {
                if (!roleName) return;
                candidateKeySet.add(`${roleName}:${applicantId}`);
            });

            // Merge responses
            const respMap = responsesByApplicant.get(applicantId);
            headerKeys.forEach((key) => {
                const nextVal = infoByKey.get(key);
                if (nextVal == null) return;
                const prev = respMap.get(key);
                const merged = mergeResponseValue(prev?.value, nextVal);
                respMap.set(key, {
                    order: orderByQuestionKey.get(key) ?? null,
                    value: merged,
                });
            });

            // Track a potential display name candidate for this applicant from this file.
            const fullNameValue = fullNameKey ? infoByKey.get(fullNameKey) : null;
            if (fullNameValue && fullNameValue.toString().trim()) {
                // Store under a synthetic key so we can pick it later.
                const prevName = respMap.get("__display_name__")?.value;
                respMap.set("__display_name__", {
                    order: -1,
                    value: mergeResponseValue(prevName, fullNameValue),
                });
            }
        });
    }

    // Build applicants rows with final display names
    for (const [email, applicantId] of applicantIdByEmail.entries()) {
        const respMap = responsesByApplicant.get(applicantId) || new Map();
        const fullNameValue = respMap.get("__display_name__")?.value || null;
        const applicantDisplayName = ensureUniqueDisplayName(
            fullNameValue,
            email,
            usedDisplayNames
        );
        applicants.push({
            id: applicantId,
            dataset_id: datasetId,
            name: applicantDisplayName,
        });
    }

    // Flatten responses
    const applicantResponses = [];
    for (const [applicantId, respMap] of responsesByApplicant.entries()) {
        for (const [questionKey, payload] of respMap.entries()) {
            if (questionKey === "__display_name__") continue;
            applicantResponses.push({
                applicant_id: applicantId,
                question_key: questionKey,
                question_order: payload?.order ?? null,
                response: payload?.value ?? null,
            });
        }
    }

    // Flatten candidates
    const applicantCandidates = [];
    for (const key of candidateKeySet) {
        const idx = key.lastIndexOf(":");
        const roleName = key.slice(0, idx);
        const applicantId = key.slice(idx + 1);
        applicantCandidates.push({
            dataset_id: datasetId,
            role_name: roleName,
            applicant_id: applicantId,
        });
    }

    // Ensure we only create roles that appear in either of the two role keys.
    const roles = [...rolesSet].filter(Boolean);

    // Mark previous dataset(s) as not current
    const { error: markErr } = await supabase
        .from("datasets")
        .update({ is_current: false })
        .eq("is_current", true);
    if (markErr) throw markErr;

    // Insert dataset + base rows
    const { error: dsErr } = await supabase.from("datasets").insert({
        id: datasetId,
        is_current: true,
    });
    if (dsErr) throw dsErr;

    const roleRows = roles.map((roleName) => ({
        dataset_id: datasetId,
        role_name: roleName,
    }));
    for (const batch of chunkArray(roleRows, 200)) {
        const { error: roleErr } = await supabase.from("roles").insert(batch);
        if (roleErr) throw roleErr;
    }

    for (const batch of chunkArray(applicants, 200)) {
        const { error: applErr } = await supabase.from("applicants").insert(batch);
        if (applErr) throw applErr;
    }

    // Insert responses and candidate mappings
    for (const batch of chunkArray(applicantResponses, 50)) {
        const { error: respErr } = await supabase.from("applicant_responses").insert(batch);
        if (respErr) throw respErr;
    }

    for (const batch of chunkArray(applicantCandidates, 200)) {
        const { error: candErr } = await supabase
            .from("applicant_role_candidates")
            .insert(batch);
        if (candErr) throw candErr;
    }

    return datasetId;
}

export { ROLE_KEYS };

