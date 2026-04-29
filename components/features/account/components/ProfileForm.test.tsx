import { render, screen, fireEvent, waitFor } from "@/test/test-utils";
import ProfileForm from "./ProfileForm";
import { describe, it, expect, vi } from "vitest";

describe("ProfileForm Component", () => {
  it("renders all form fields", () => {
    render(<ProfileForm />);
    
    expect(screen.getByLabelText(/First Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Last Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Address/i)).toBeInTheDocument();
  });

  it("shows validation errors on empty submit", async () => {
    render(<ProfileForm />);
    
    const saveButton = screen.getByText(/Save Changes/i);
    fireEvent.click(saveButton);
    
    expect(await screen.findByText(/First Name is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Email is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Gender is required/i)).toBeInTheDocument();
  });

  it("shows error for invalid email", async () => {
    render(<ProfileForm />);
    
    const emailInput = screen.getByLabelText(/Email/i);
    fireEvent.change(emailInput, { target: { value: "invalid-email" } });
    
    const saveButton = screen.getByText(/Save Changes/i);
    fireEvent.click(saveButton);
    
    expect(await screen.findByText(/Invalid email format/i)).toBeInTheDocument();
  });

  it("successfully submits when form is valid", async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    render(<ProfileForm />);
    
    fireEvent.change(screen.getByLabelText(/First Name/i), { target: { value: "John" } });
    fireEvent.change(screen.getByLabelText(/Last Name/i), { target: { value: "Doe" } });
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: "john@example.com" } });
    fireEvent.change(screen.getByLabelText(/Phone Number/i), { target: { value: "1234567890" } });
    fireEvent.change(screen.getByLabelText(/ID/i), { target: { value: "ID123" } });
    fireEvent.change(screen.getByLabelText(/Identification Country/i), { target: { value: "USA" } });
    fireEvent.change(screen.getByLabelText(/Address/i), { target: { value: "123 Main St" } });
    
    const maleRadio = screen.getByLabelText(/male/i);
    fireEvent.click(maleRadio);
    
    const saveButton = screen.getByText(/Save Changes/i);
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith("Profile updated successfully!");
    }, { timeout: 2000 });
    
    alertMock.mockRestore();
  });
});
