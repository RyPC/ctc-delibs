import { useState } from "react";
import {
    Box,
    Button,
    Text,
    VStack,
    HStack,
    Card,
    CardBody,
    Heading,
    useToast,
} from "@chakra-ui/react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const applicantsData = [
    { name: "Alice Johnson", roles: ["Software Engineer", "Data Analyst"] },
    { name: "Bob Smith", roles: ["Software Engineer", "Product Manager"] },
    { name: "Charlie Brown", roles: ["Data Analyst", "UX Designer"] },
];

const COLORS = ["#7D3C98", "#9B59B6", "#BB8FCE", "#D2B4DE"];

export default function JobApplicantsVisualizer() {
    const [selectedApplicants, setSelectedApplicants] = useState(new Set());
    const toast = useToast();

    const handleSelectApplicant = (name) => {
        setSelectedApplicants((prev) => new Set(prev).add(name));
        toast({
            title: `${name} selected`,
            status: "success",
            duration: 2000,
            isClosable: true,
        });
    };

    const roleCounts = applicantsData
        .flatMap((a) => a.roles)
        .reduce((acc, role) => {
            acc[role] = (acc[role] || 0) + 1;
            return acc;
        }, {});

    const pieData = Object.keys(roleCounts).map((role, index) => ({
        name: role,
        value: roleCounts[role],
        fill: COLORS[index % COLORS.length],
    }));

    return (
        <Box p={6} bg="gray.50" minH="100vh" fontFamily="Inter, sans-serif">
            <Heading size="xl" color="purple.600" mb={6}>
                Job Applicants Overview
            </Heading>
            <HStack align="start" spacing={8}>
                <VStack align="start" spacing={4} flex={1}>
                    <Heading size="md" color="purple.500">
                        Applicant List
                    </Heading>
                    <VStack align="start" spacing={4} w="full">
                        {[
                            ...new Set(applicantsData.flatMap((a) => a.roles)),
                        ].map((role) => (
                            <Card
                                key={role}
                                w="full"
                                p={4}
                                borderLeft="4px solid"
                                borderColor="purple.500"
                            >
                                <CardBody>
                                    <Heading
                                        size="sm"
                                        color="purple.700"
                                        mb={2}
                                    >
                                        {role}
                                    </Heading>
                                    <VStack align="start" spacing={2}>
                                        {applicantsData
                                            .filter((applicant) =>
                                                applicant.roles.includes(role)
                                            )
                                            .map((applicant) => (
                                                <HStack
                                                    key={applicant.name}
                                                    justify="space-between"
                                                    w="full"
                                                >
                                                    <Text
                                                        textDecoration={
                                                            selectedApplicants.has(
                                                                applicant.name
                                                            )
                                                                ? "line-through"
                                                                : "none"
                                                        }
                                                        color={
                                                            selectedApplicants.has(
                                                                applicant.name
                                                            )
                                                                ? "gray.400"
                                                                : "black"
                                                        }
                                                    >
                                                        {applicant.name}
                                                    </Text>
                                                    {!selectedApplicants.has(
                                                        applicant.name
                                                    ) && (
                                                        <Button
                                                            size="sm"
                                                            colorScheme="purple"
                                                            onClick={() =>
                                                                handleSelectApplicant(
                                                                    applicant.name
                                                                )
                                                            }
                                                        >
                                                            Select
                                                        </Button>
                                                    )}
                                                </HStack>
                                            ))}
                                    </VStack>
                                </CardBody>
                            </Card>
                        ))}
                    </VStack>
                </VStack>
                <Box flex={1} bg="white" p={4} borderRadius="lg" shadow="md">
                    <Heading size="md" color="purple.500" mb={4}>
                        Role Distribution
                    </Heading>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                outerRadius={100}
                                dataKey="value"
                            >
                                {pieData.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={entry.fill}
                                    />
                                ))}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                </Box>
            </HStack>
        </Box>
    );
}
