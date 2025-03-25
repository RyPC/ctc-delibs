import { useState } from "react";
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
} from "@chakra-ui/react";
import Papa from "papaparse";

const COLORS = ["#740aff", "#5a00d1", "#4d02b0"];

const ROLE_KEYS = [
    "What role(s) are you interested in? Please choose up to 2.",
    "What role are you applying for?",
];

export default function JobApplicantsVisualizer() {
    const { isOpen, onOpen, onClose } = useDisclosure();

    // All applicants
    const [applicants, setApplicants] = useState(new Set());

    // Available roles mapping to potential applicants
    const [roles, setRoles] = useState(new Map());

    // Selected applicant for modal info
    const [selectedApplicant, setSelectedApplicant] = useState(null);

    // Role currently being looked at
    const [activeRole, setActiveRole] = useState("");

    // const handleSelectApplicant = (name) => {
    //     setSelectedApplicants((prev) => new Set(prev).add(name));
    // };

    // Returns a function that will select the role
    const selectRole = (role) => {
        return () => {
            setActiveRole(role);
        };
    };

    // Adds current applicant to list of selected
    const selectApplicant = () => {
        // Error checking
        if (!roles.has(activeRole)) {
            return;
        }

        // Duplicate lists for setting useStates
        const newRoles = new Map(roles);
        const selected = new Set(roles.get(activeRole));

        // Add selectedApplicant to list
        selected.add(selectedApplicant);
        newRoles.set(activeRole, selected);
        setRoles(newRoles);

        onClose();
    };

    // Removes current applicant from list of selected
    const unselectApplicant = (applicant, role) => () => {
        // Error checking
        if (!roles.has(role) || !roles.get(role).has(applicant)) {
            console.log(roles.get(role));
            console.log(applicant);
            return;
        }

        // Duplicate lists for setting useStates
        const newRoles = new Map(roles);
        const selected = new Set(roles.get(role));

        // Remove selectedApplicant from list
        selected.delete(applicant);
        newRoles.set(role, selected);
        setRoles(newRoles);

        onClose();
    };

    // Redirection from onOpen to populate content from applicant
    const openModal = (name) => () => {
        setSelectedApplicant(name);
        onOpen();
    };
    // Handles uploading file from user
    const handleFileUpload = (event) => {
        const file = event.target.files[0]; // Get the uploaded file
        if (file) {
            readFile(file); // Call readFile to read the file content
        }
    };

    const readFile = (file) => {
        const reader = new FileReader();

        reader.onload = () => {
            const csvContent = reader.result; // Get the file content as text
            parseCSV(csvContent); // Call parseCSV to parse the content
        };

        reader.readAsText(file); // Read the file as text
    };

    // Parses CSV to create map of apps (people to responses(map))
    const parseCSV = (csvContent) => {
        Papa.parse(csvContent, {
            complete: (result) => {
                const parsedData = result.data;

                // Find keys of everything after name
                const keys = parsedData[0].slice(2);

                // Set of roles
                const newRoles = new Map();

                // Create map of names to info
                const nameMap = new Map();
                parsedData.forEach((row, index) => {
                    if (index === 0) return;

                    // First column = timestamp
                    // Second column = name (key)
                    const key = row[1];
                    const values = row.slice(2);

                    // Create map of info
                    const infoMap = new Map();
                    values.forEach((value, index) => {
                        infoMap.set(keys[index], value);
                    });

                    // Add to roles useState
                    ROLE_KEYS.forEach((key) => {
                        if (infoMap.has(key)) {
                            const addedRoles = infoMap.get(key).split(";");
                            addedRoles.forEach((role) => {
                                newRoles.set(role, new Set());
                            });
                        }
                    });

                    nameMap.set(key, infoMap);
                });

                console.log(nameMap);

                setRoles(newRoles);
                setApplicants(nameMap);
            },
            header: false, // Skip headers in CSV
        });
    };

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
                <Heading size="xl" color={COLORS[1]} mb={6}>
                    CTC Board Deliberations
                </Heading>

                {/* FOR UPLOADING CSV */}
                {applicants.size > 0 ? (
                    <HStack align="start" spacing={8}>
                        <VStack align="start" spacing={4} flex={1}>
                            <Heading size="lg" color={COLORS[0]}>
                                Board Positions
                            </Heading>
                            <Flex align="start" gap={4} wrap="wrap">
                                {[...roles].map(([role, _]) => (
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
                                        {roles.get(role).size > 0 && (
                                            <CardBody pt={0}>
                                                <VStack spacing={0}>
                                                    <Text fontWeight="bold">
                                                        Selected
                                                    </Text>
                                                    {[...roles.get(role)].map(
                                                        (applicant) => (
                                                            <>
                                                                <Tooltip
                                                                    selectedApplicant
                                                                    label="Remove"
                                                                    aria-label="A tooltip"
                                                                    placement="left"
                                                                >
                                                                    <Box
                                                                        p={2}
                                                                        m={0}
                                                                        bg="gray.300"
                                                                        fontFamily="Inter, sans-serif"
                                                                        borderRadius={
                                                                            10
                                                                        }
                                                                        margin={
                                                                            15
                                                                        }
                                                                        _hover={{
                                                                            opacity:
                                                                                "50%",
                                                                        }}
                                                                        transition="all 0.2s ease-in-out"
                                                                        onClick={unselectApplicant(
                                                                            applicant,
                                                                            role
                                                                        )}
                                                                    >
                                                                        <Text userSelect="none">
                                                                            {
                                                                                applicant
                                                                            }
                                                                        </Text>
                                                                    </Box>
                                                                </Tooltip>
                                                            </>
                                                        )
                                                    )}
                                                </VStack>
                                            </CardBody>
                                        )}
                                    </Card>
                                ))}
                            </Flex>
                        </VStack>
                        <VStack flex={1}>
                            <Box>
                                <Heading size="lg" color={COLORS[0]} mb={4}>
                                    {activeRole + " Applicants"}
                                </Heading>
                            </Box>
                            <Flex
                                wrap="wrap"
                                gap={4}
                                justify="center"
                                flexDirection="row"
                                marginTop={50}
                            >
                                {[...applicants]
                                    .filter(
                                        ([name, responses]) =>
                                            (responses.has(ROLE_KEYS[0]) &&
                                                responses
                                                    .get(ROLE_KEYS[0])
                                                    .includes(activeRole)) ||
                                            (responses.has(ROLE_KEYS[1]) &&
                                                responses
                                                    .get(ROLE_KEYS[1])
                                                    .includes(activeRole))
                                    )
                                    .map(([name, responses]) => (
                                        <Card
                                            key={name}
                                            size="lg"
                                            className="p-4 shadow-lg rounded-2xl"
                                            border="2px solid"
                                            borderColor="#a100ff"
                                            borderRadius={10}
                                            backgroundColor="white"
                                            boxShadow="0 10px 15px -3px rgba(161, 0, 255, 0.3), 0 4px 6px -2px rgba(161, 0, 255, 0.05)"
                                            opacity="65%"
                                            _hover={{
                                                opacity: "100%",
                                                transform: "translateY(-2px)",
                                                boxShadow: "lg",
                                            }}
                                            _active={{
                                                opacity: "100%",
                                                transform: "translateY(-1px)",
                                                boxShadow: "lg",
                                            }}
                                            transition="all 0.2s ease-in-out"
                                            onClick={openModal(name)}
                                        >
                                            <CardHeader>
                                                <Heading
                                                    size="md"
                                                    color={COLORS[2]}
                                                    textAlign="center"
                                                    userSelect="none"
                                                >
                                                    {name}
                                                </Heading>
                                            </CardHeader>
                                        </Card>
                                    ))}
                            </Flex>
                        </VStack>
                    </HStack>
                ) : (
                    <Box>
                        <VStack>
                            <Heading size="xl" color={COLORS[0]} mb={6}>
                                Upload .csv file
                            </Heading>
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
                                />
                            </Flex>
                        </VStack>
                    </Box>
                )}
            </Box>

            <Modal isOpen={isOpen} onClose={onClose} size={"3xl"}>
                <ModalOverlay />
                <ModalContent>
                    <ModalHeader>{selectedApplicant}</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody>
                        <VStack
                            spacing={5}
                            align="stretch"
                            width="full"
                            divider={<Divider borderColor={COLORS[1]} />}
                        >
                            {applicants.has(selectedApplicant) &&
                                [...applicants.get(selectedApplicant)].map(
                                    ([question, response], index) => (
                                        <Flex
                                            key={index}
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
                                )}
                        </VStack>
                    </ModalBody>

                    <ModalFooter>
                        {roles.has(activeRole) &&
                        roles.get(activeRole).has(selectedApplicant) ? (
                            <Button
                                colorScheme="blue"
                                mr={3}
                                onClick={unselectApplicant(
                                    selectedApplicant,
                                    activeRole
                                )}
                            >
                                Unselect
                            </Button>
                        ) : (
                            <Button
                                colorScheme="green"
                                mr={3}
                                onClick={selectApplicant}
                            >
                                Select
                            </Button>
                        )}
                        <Button colorScheme="purple" mr={3} onClick={onClose}>
                            Close
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </>
    );
}
