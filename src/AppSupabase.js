import { useEffect, useMemo, useState } from "react";
import {
    Box,
    Flex,
    Text,
    Button,
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalFooter,
    ModalBody,
    ModalCloseButton,
    Divider,
    useDisclosure,
    VStack,
    HStack,
    Card,
    CardBody,
    CardHeader,
    Tooltip,
    Heading,
    Spinner,
} from "@chakra-ui/react";
import {
    fetchApplicantResponses,
    fetchCandidatesForRole,
    fetchRolesForDataset,
    getCurrentDatasetId,
    importCsvAsNewCurrentDataset,
    ROLE_KEYS,
} from "./lib/supabaseApi";
import { isSupabaseConfigured, supabase } from "./supabaseClient";

const COLORS = ["#740aff", "#5a00d1", "#4d02b0"];

function emptyMap() {
    return new Map();
}

function formatError(err) {
    if (!err) return "Unknown error";
    if (typeof err === "string") return err;
    if (err instanceof Error && err.message) return err.message;
    if (typeof err?.message === "string" && err.message) return err.message;
    if (typeof err?.error?.message === "string") return err.error.message;
    try {
        return JSON.stringify(err, null, 2);
    } catch {
        return String(err);
    }
}

export default function AppSupabase() {
    const { isOpen, onOpen, onClose } = useDisclosure();

    const [currentDatasetId, setCurrentDatasetId] = useState(null);
    const [roles, setRoles] = useState([]);
    const [applicantsById, setApplicantsById] = useState(emptyMap());

    const [activeRole, setActiveRole] = useState("");
    const [candidates, setCandidates] = useState([]); // {id,name} for active role

    // Selections are local per viewer.
    const [draftSelectionsByRole, setDraftSelectionsByRole] = useState(
        emptyMap()
    ); // roleName -> Set(applicantId)

    // Modal state
    const [selectedApplicantId, setSelectedApplicantId] = useState(null);
    const [selectedApplicantName, setSelectedApplicantName] = useState("");
    const [modalResponses, setModalResponses] = useState([]); // [[q, r]]

    const [initialLoading, setInitialLoading] = useState(true);
    const [importing, setImporting] = useState(false);
    const [modalLoading, setModalLoading] = useState(false);
    const [importError, setImportError] = useState(null);

    const draftApplicantIds = useMemo(() => {
        const ids = new Set();
        for (const set of draftSelectionsByRole.values()) {
            for (const id of set) ids.add(id);
        }
        return ids;
    }, [draftSelectionsByRole]);

    const isSupabaseReady = isSupabaseConfigured();

    // Surface unexpected runtime/unhandled errors in the UI instead of the
    // generic CRA overlay stringifying them as [object Object].
    useEffect(() => {
        const onRejection = (event) => {
            setImportError((prev) => prev || formatError(event?.reason));
        };
        const onError = (event) => {
            setImportError((prev) => prev || formatError(event?.error || event));
        };
        window.addEventListener("unhandledrejection", onRejection);
        window.addEventListener("error", onError);
        return () => {
            window.removeEventListener("unhandledrejection", onRejection);
            window.removeEventListener("error", onError);
        };
    }, []);

    // Initial load: current dataset id
    useEffect(() => {
        let alive = true;
        async function run() {
            try {
                if (!isSupabaseReady) {
                    if (alive) setCurrentDatasetId(null);
                    return;
                }
                const id = await getCurrentDatasetId();
                if (!alive) return;
                setCurrentDatasetId(id);
            } finally {
                if (alive) setInitialLoading(false);
            }
        }
        run();
        return () => {
            alive = false;
        };
    }, [isSupabaseReady]);

    // Load dataset state whenever currentDatasetId changes
    useEffect(() => {
        let alive = true;
        async function run() {
            if (!currentDatasetId) return;
            if (!supabase) return;

            setImportError(null);

            const [rolesList] = await Promise.all([
                fetchRolesForDataset(currentDatasetId),
            ]);

            // Load all applicant ids->names so role cards can render lists.
            const { data: allApplicants, error: allApplicantsErr } = await supabase
                .from("applicants")
                .select("id, name")
                .eq("dataset_id", currentDatasetId);
            if (allApplicantsErr) throw allApplicantsErr;

            if (!alive) return;
            setRoles(rolesList);

            const nameMap = new Map();
            (allApplicants || []).forEach((a) => nameMap.set(a.id, a.name));
            setApplicantsById(nameMap);

            // Reset drafts on dataset change.
            setDraftSelectionsByRole(emptyMap());
            setCandidates([]);
            setSelectedApplicantId(null);
            setModalResponses([]);

            // Keep activeRole if still present, otherwise use first.
            const nextActive =
                rolesList.includes(activeRole) && rolesList.length > 0
                    ? activeRole
                    : rolesList[0] || "";
            setActiveRole(nextActive);
        }

        run().catch((e) => {
            // eslint-disable-next-line no-console
            console.error(e);
            if (alive) setImportError(formatError(e));
        });

        return () => {
            alive = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentDatasetId]);

    // Fetch candidates whenever activeRole changes
    useEffect(() => {
        let alive = true;
        async function run() {
            if (!currentDatasetId || !activeRole) return;
            const candidateRows = await fetchCandidatesForRole(
                currentDatasetId,
                activeRole
            );
            if (!alive) return;
            setCandidates(candidateRows);
        }
        run();
        return () => {
            alive = false;
        };
    }, [currentDatasetId, activeRole]);

    const selectRole = (role) => () => setActiveRole(role);

    const toggleDraftSelection = (applicantId, roleName) => {
        setDraftSelectionsByRole((prev) => {
            const next = new Map(prev);
            const set = new Set(next.get(roleName) || []);
            if (set.has(applicantId)) set.delete(applicantId);
            else set.add(applicantId);

            if (set.size === 0) next.delete(roleName);
            else next.set(roleName, set);
            return next;
        });
    };

    const openModal = (applicantId) => async () => {
        setSelectedApplicantId(applicantId);
        setSelectedApplicantName(applicantsById.get(applicantId) || "");
        setModalLoading(true);
        setImportError(null);
        try {
            const responses = await fetchApplicantResponses(applicantId);
            setModalResponses(responses);
            onOpen();
        } catch (e) {
            setImportError(formatError(e));
        } finally {
            setModalLoading(false);
        }
    };

    const handleFileUpload = async (event) => {
        const files = Array.from(event.target.files || []).filter(Boolean);
        if (files.length === 0) return;
        if (!supabase) return;

        setImportError(null);
        setImporting(true);
        try {
            const datasetId = await importCsvAsNewCurrentDataset(files);
            setCurrentDatasetId(datasetId);
        } catch (e) {
            setImportError(formatError(e));
        } finally {
            setImporting(false);
            // Allow uploading the same file again.
            event.target.value = null;
        }
    };

    const draftActiveSet =
        draftSelectionsByRole.get(activeRole) || new Set();

    function getCardBorderColor(applicantId) {
        if (draftActiveSet.has(applicantId)) return "blue.400";
        return "#a100ff";
    }

    function getCardBoxShadow(applicantId) {
        // Draft indicator (per viewer)
        if (draftActiveSet.has(applicantId))
            return "0 0px 15px 0px rgba(0, 140, 255, 0.65)";
        if (draftApplicantIds.has(applicantId))
            return "0 0px 15px 0px rgba(255, 180, 0, 0.60)";

        // Default
        return "0 10px 15px -3px rgba(161, 0, 255, 0.3), 0 4px 6px -2px rgba(161, 0, 255, 0.05)";
    }

    const showBoard = Boolean(currentDatasetId && roles.length > 0);

    return (
        <>
            {/* BACKGROUND */}
            <img
                src="ctclogo.svg"
                alt="CTC Logo"
                style={{
                    position: "fixed",
                    left: "50%",
                    top: "50%",
                    transform: "translate(-50%, -50%)",
                    height: "60%",
                    opacity: "65%",
                    userSelect: "none",
                    pointerEvents: "none",
                }}
            />

            <Box
                p={6}
                bg="gray.50"
                minH="100vh"
                fontFamily="Inter, sans-serif"
                margin={15}
            >
                <Flex align="center" justify="space-between" mb={6}>
                    <Heading size="xl" color={COLORS[1]}>
                        CTC Board Deliberations
                    </Heading>
                </Flex>

                {!isSupabaseReady && (
                    <Text color="red.500">
                        Supabase is not configured. Set `REACT_APP_SUPABASE_URL`
                        and `REACT_APP_SUPABASE_ANON_KEY`.
                    </Text>
                )}

                {importError && (
                    <Text color="red.500" mb={4}>
                        {importError}
                    </Text>
                )}

                {(initialLoading || importing) && !showBoard && (
                    <Flex align="center" justify="center" minH="200px">
                        <Spinner size="lg" />
                    </Flex>
                )}

                {showBoard ? (
                    <HStack align="start" spacing={8}>
                        <VStack align="start" spacing={4} flex={1}>
                            <Heading size="lg" color={COLORS[0]}>
                                Board Positions
                            </Heading>

                            <Flex align="start" gap={4} wrap="wrap">
                                {roles.map((role) => {
                                    const draftSet =
                                        draftSelectionsByRole.get(role) ||
                                        new Set();
                                    return (
                                        <Card
                                            key={role}
                                            size="lg"
                                            w="40%"
                                            border="4px solid"
                                            borderRadius={20}
                                            borderColor={COLORS[0]}
                                            backgroundColor="white"
                                            boxShadow="lg"
                                            opacity={
                                                activeRole === role ? "100%" : "65%"
                                            }
                                            transform={
                                                activeRole === role
                                                    ? "scale(1.025)"
                                                    : "scale(1)"
                                            }
                                            _hover={{
                                                opacity: "100%",
                                                transform: "scale(1.05)",
                                            }}
                                            _active={{
                                                opacity: "100%",
                                                transform: "scale(1.025)",
                                            }}
                                            transition="all 0.2s ease-in-out"
                                            onClick={selectRole(role)}
                                        >
                                            <CardHeader>
                                                <Heading
                                                    size="md"
                                                    color={COLORS[2]}
                                                    margin={2}
                                                    userSelect="none"
                                                >
                                                    {role}
                                                </Heading>
                                            </CardHeader>
                                            <CardBody pt={0}>
                                                {draftSet.size > 0 && (
                                                    <>
                                                        <Text
                                                            fontWeight="bold"
                                                            color="#008cff"
                                                            mb={2}
                                                        >
                                                            Draft Selected
                                                        </Text>
                                                        <VStack
                                                            spacing={0}
                                                            align="stretch"
                                                        >
                                                            {[...draftSet].map(
                                                                (applicantId) => (
                                                                    <Tooltip
                                                                        key={applicantId}
                                                                        label="Remove draft selection"
                                                                        aria-label="Draft remove"
                                                                        placement="left"
                                                                    >
                                                                        <Box
                                                                            p={2}
                                                                            m={0}
                                                                            bg="blue.50"
                                                                            border="1px solid"
                                                                            borderColor="blue.300"
                                                                            borderRadius={10}
                                                                            margin={15}
                                                                            _hover={{
                                                                                opacity: "50%",
                                                                            }}
                                                                            transition="all 0.2s ease-in-out"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                toggleDraftSelection(
                                                                                    applicantId,
                                                                                    role
                                                                                );
                                                                            }}
                                                                        >
                                                                            <Text userSelect="none">
                                                                                {
                                                                                    applicantsById.get(
                                                                                        applicantId
                                                                                    ) || "Unknown"
                                                                                }
                                                                            </Text>
                                                                        </Box>
                                                                    </Tooltip>
                                                                )
                                                            )}
                                                        </VStack>
                                                    </>
                                                )}

                                            </CardBody>
                                        </Card>
                                    );
                                })}
                            </Flex>
                        </VStack>

                        <VStack flex={1}>
                            <Flex
                                align="center"
                                justify="space-between"
                                w="full"
                            >
                                <Heading size="lg" color={COLORS[0]} mb={4}>
                                    {activeRole + " Applicants"}
                                </Heading>

                            </Flex>

                            <Flex
                                wrap="wrap"
                                gap={4}
                                justify="center"
                                flexDirection="row"
                                marginTop={50}
                            >
                                {candidates.map((applicant) => {
                                    const isDraftSelected =
                                        draftActiveSet.has(applicant.id);
                                    return (
                                        <Box
                                            position="relative"
                                            key={applicant.id}
                                            _hover={{
                                                "& .select-button": {
                                                    opacity: 1,
                                                    visibility: "visible",
                                                },
                                            }}
                                        >
                                            <Card
                                                size="lg"
                                                className="p-4 shadow-lg rounded-2xl"
                                                border="2px solid"
                                                borderColor={getCardBorderColor(
                                                    applicant.id
                                                )}
                                                borderRadius={10}
                                                backgroundColor="white"
                                                boxShadow={getCardBoxShadow(
                                                    applicant.id
                                                )}
                                                opacity="65%"
                                                _hover={{
                                                    opacity: "100%",
                                                    transform: "translateY(-2px)",
                                                }}
                                                _active={{
                                                    opacity: "100%",
                                                    transform: "translateY(-1px)",
                                                }}
                                                transition="all 0.2s ease-in-out"
                                                onClick={openModal(
                                                    applicant.id
                                                )}
                                            >
                                                <CardHeader>
                                                    <Heading
                                                        size="md"
                                                        color={COLORS[2]}
                                                        textAlign="center"
                                                        userSelect="none"
                                                    >
                                                        {applicant.name}
                                                    </Heading>
                                                    {isDraftSelected && (
                                                        <Text
                                                            mt={2}
                                                            fontSize="sm"
                                                            color="blue.600"
                                                        >
                                                            Draft
                                                        </Text>
                                                    )}
                                                </CardHeader>
                                            </Card>

                                            <Button
                                                className="select-button"
                                                position="absolute"
                                                top="75%"
                                                left="50%"
                                                transform="translate(-50%, -25%)"
                                                opacity={0}
                                                visibility="hidden"
                                                transition="all 0.2s"
                                                colorScheme="purple"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleDraftSelection(
                                                        applicant.id,
                                                        activeRole
                                                    );
                                                }}
                                            >
                                                {isDraftSelected
                                                    ? "Unselect"
                                                    : "Select"}
                                            </Button>
                                        </Box>
                                    );
                                })}
                            </Flex>
                        </VStack>
                    </HStack>
                ) : (
                    <Box>
                        <VStack>
                            <Heading size="xl" color={COLORS[0]} mb={6}>
                                Upload .csv file
                            </Heading>
                            <Text color="gray.600" mb={4}>
                                CSV must include the columns used by:
                                <Text as="span" fontWeight="bold">
                                    {" "}
                                    {ROLE_KEYS[0]}{" "}
                                </Text>
                                and{" "}
                                <Text as="span" fontWeight="bold">
                                    {ROLE_KEYS[1]}{" "}
                                </Text>
                            </Text>
                            <Flex
                                wrap="wrap"
                                gap={4}
                                justify="center"
                                flexDirection="row"
                                marginTop={50}
                            >
                                <input
                                    type="file"
                                    accept=".csv"
                                    onChange={handleFileUpload}
                                    className="mb-4"
                                    multiple
                                    disabled={
                                        !isSupabaseReady || importing
                                    }
                                />
                            </Flex>

                            {importing && (
                                <Text color="gray.600" mt={4}>
                                    Importing...
                                </Text>
                            )}
                        </VStack>
                    </Box>
                )}
            </Box>

            <Modal isOpen={isOpen} onClose={onClose} size={"3xl"}>
                <ModalOverlay />
                <ModalContent>
                    <ModalHeader>{selectedApplicantName}</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody>
                        <VStack
                            spacing={5}
                            align="stretch"
                            width="full"
                            divider={<Divider borderColor={COLORS[1]} />}
                        >
                            {modalLoading ? (
                                <Flex
                                    align="center"
                                    justify="center"
                                    minH="120px"
                                >
                                    <Spinner />
                                </Flex>
                            ) : (
                                modalResponses.map(
                                    ([question, response], index) => (
                                        <Flex
                                            key={`${index}-${question}`}
                                            direction="column"
                                            bg="gray.50"
                                            p={4}
                                            borderRadius="md"
                                            boxShadow="sm"
                                        >
                                            <Text
                                                fontWeight="bold"
                                                color={COLORS[0]}
                                                mb={2}
                                                fontSize="md"
                                            >
                                                {question}
                                            </Text>
                                            <Text
                                                color="gray.700"
                                                lineHeight="tall"
                                                whiteSpace="pre-wrap"
                                            >
                                                {response}
                                            </Text>
                                        </Flex>
                                    )
                                )
                            )}
                        </VStack>
                    </ModalBody>

                    <ModalFooter>
                        {activeRole && selectedApplicantId ? (
                            draftSelectionsByRole.get(activeRole)?.has(
                                selectedApplicantId
                            ) ? (
                                <Button
                                    colorScheme="blue"
                                    mr={3}
                                    onClick={() =>
                                        toggleDraftSelection(
                                            selectedApplicantId,
                                            activeRole
                                        )
                                    }
                                >
                                    Unselect (Draft)
                                </Button>
                            ) : (
                                <Button
                                    colorScheme="green"
                                    mr={3}
                                    onClick={() =>
                                        toggleDraftSelection(
                                            selectedApplicantId,
                                            activeRole
                                        )
                                    }
                                >
                                    Select (Draft)
                                </Button>
                            )
                        ) : null}
                        <Button
                            colorScheme="purple"
                            mr={3}
                            onClick={onClose}
                        >
                            Close
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </>
    );
}

