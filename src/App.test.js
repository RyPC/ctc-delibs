import { render, screen } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import App from "./AppSupabase";

test("renders the CTC Board Deliberations heading", () => {
    render(
        <ChakraProvider>
            <App />
        </ChakraProvider>
    );
    const headingElement = screen.getByText(/CTC Board Deliberations/i);
    expect(headingElement).toBeInTheDocument();
});
