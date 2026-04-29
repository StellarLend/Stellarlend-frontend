import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';
import ProfileForm from '../components/features/account/components/ProfileForm';

const meta: Meta<typeof ProfileForm> = {
  title: 'Features/Account/ProfileForm',
  component: ProfileForm,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof ProfileForm>;

export const Default: Story = {};

export const ErrorStates: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Find the save changes button
    const saveButton = canvas.getByRole('button', { name: /Save Changes/i });
    await expect(saveButton).toBeInTheDocument();
    
    // Click it to trigger validation
    await userEvent.click(saveButton);
    
    // Check for error messages
    const firstNameError = canvas.getByText(/First name is required/i);
    await expect(firstNameError).toBeInTheDocument();
    
    const lastNameError = canvas.getByText(/Last name is required/i);
    await expect(lastNameError).toBeInTheDocument();
    
    const emailError = canvas.getByText(/Email is required/i);
    await expect(emailError).toBeInTheDocument();
    
    const phoneError = canvas.getByText(/Phone number is required/i);
    await expect(phoneError).toBeInTheDocument();
    
    const idError = canvas.getByText(/ID number is required/i);
    await expect(idError).toBeInTheDocument();
    
    const taxIdError = canvas.getByText(/Tax verification number is required/i);
    await expect(taxIdError).toBeInTheDocument();
    
    const countryError = canvas.getByText(/Identification country is required/i);
    await expect(countryError).toBeInTheDocument();
    
    const addressError = canvas.getByText(/Address is required/i);
    await expect(addressError).toBeInTheDocument();
    
    const genderError = canvas.getByText(/Gender is required/i);
    await expect(genderError).toBeInTheDocument();
  },
};

export const PartialFill: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Fill first name
    const firstNameInput = canvas.getByLabelText(/First Name/i);
    await userEvent.type(firstNameInput, 'Jane');
    
    // Click save
    const saveButton = canvas.getByRole('button', { name: /Save Changes/i });
    await userEvent.click(saveButton);
    
    // Check that First Name error is NOT present, but others are
    await expect(canvas.queryByText(/First name is required/i)).not.toBeInTheDocument();
    
    const lastNameError = canvas.getByText(/Last name is required/i);
    await expect(lastNameError).toBeInTheDocument();
  }
};

export const InvalidFormats: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Fill invalid email and phone
    const emailInput = canvas.getByLabelText(/Email/i);
    await userEvent.type(emailInput, 'not-an-email');
    
    const phoneInput = canvas.getByLabelText(/Phone Number/i);
    await userEvent.type(phoneInput, '123'); // too short
    
    // Click save
    const saveButton = canvas.getByRole('button', { name: /Save Changes/i });
    await userEvent.click(saveButton);
    
    // Check for format error messages
    const emailFormatError = canvas.getByText(/Please enter a valid email address/i);
    await expect(emailFormatError).toBeInTheDocument();
    
    const phoneFormatError = canvas.getByText(/Please enter a valid phone number/i);
    await expect(phoneFormatError).toBeInTheDocument();
  }
};

export const FullFill: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Fill all text fields
    await userEvent.type(canvas.getByLabelText(/First Name/i), 'Jane');
    await userEvent.type(canvas.getByLabelText(/Last Name/i), 'Doe');
    await userEvent.type(canvas.getByLabelText(/Email/i), 'jane.doe@example.com');
    await userEvent.type(canvas.getByLabelText(/Phone Number/i), '+15555555555');
    await userEvent.type(canvas.getByLabelText(/ID Number/i), 'AB123456C');
    await userEvent.type(canvas.getByLabelText(/Tax Verification Number/i), '12-3456789');
    await userEvent.type(canvas.getByLabelText(/Identification Country/i), 'United States');
    await userEvent.type(canvas.getByLabelText(/Address/i), '123 Main Street, Anytown, USA');
    
    // Select Gender
    const maleRadio = canvas.getByDisplayValue('male');
    await userEvent.click(maleRadio);
    
    // Click save
    const saveButton = canvas.getByRole('button', { name: /Save Changes/i });
    await userEvent.click(saveButton);
    
    // Verify no errors are present
    await expect(canvas.queryByText(/is required/i)).not.toBeInTheDocument();
    await expect(canvas.queryByText(/Please enter a valid/i)).not.toBeInTheDocument();
  }
};

export const ClearErrors: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Trigger errors
    const saveButton = canvas.getByRole('button', { name: /Save Changes/i });
    await userEvent.click(saveButton);
    
    // Verify errors are present
    await expect(canvas.getByText(/First name is required/i)).toBeInTheDocument();
    await expect(canvas.getByText(/Gender is required/i)).toBeInTheDocument();
    
    // Type into first name to clear error
    const firstNameInput = canvas.getByLabelText(/First Name/i);
    await userEvent.type(firstNameInput, 'Jane');
    await expect(canvas.queryByText(/First name is required/i)).not.toBeInTheDocument();
    
    // Click gender radio to clear error
    const maleRadio = canvas.getByDisplayValue('male');
    await userEvent.click(maleRadio);
    await expect(canvas.queryByText(/Gender is required/i)).not.toBeInTheDocument();
  }
};
