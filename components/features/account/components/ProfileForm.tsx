import React, { useMemo, useState, ChangeEvent, MouseEvent } from "react";
import Image, { StaticImageData } from "next/image";
import profile from "@/public/images/p-Picture.jpg";
import Camera from "@/public/camera-ai-fill.svg"; 
import { EmptyState } from "@/components/shared/common/EmptyState";

const formFields = [
  { id: "firstName", label: "First Name", placeholder: "e.g. John", type: "text", group: "personal", helpText: "Please enter your legal first name." },
  { id: "lastName", label: "Last Name", placeholder: "e.g. Doe", type: "text", group: "personal", helpText: "Please enter your legal last name." },
  { id: "email", label: "Email", placeholder: "john.doe@example.com", type: "email", group: "contact", helpText: "Used for account notifications." },
  { id: "phone", label: "Phone Number", placeholder: "+1 (555) 000-0000", type: "tel", group: "contact", helpText: "Include your country code." },
  { id: "id", label: "ID Number", placeholder: "e.g. AB123456C", type: "text", group: "verification", helpText: "National ID, passport, or driver's license." },
  { id: "taxId", label: "Tax Verification Number", placeholder: "e.g. 12-3456789", type: "text", group: "verification", helpText: "Required for tax reporting." },
  { id: "country", label: "Identification Country", placeholder: "e.g. United States", type: "text", group: "verification", helpText: "The country that issued your ID." },
];

const initialFormData: Record<string, string> = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  id: "",
  taxId: "",
  country: "",
  address: "",
};

const ProfileForm: React.FC = () => {
  const [avatar, setAvatar] = useState<string | StaticImageData>(profile);
  const [gender, setGender] = useState<"male" | "female" | "">("");
  const [formData, setFormData] = useState<Record<string, string>>({
    address: ""
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // fn to handle profile image manipulations
  const handleAvatarUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) setAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // fn to handle inputs data
  const handleInputChange = (id: string, value: string) => {
    setFormData(prev => ({ ...prev, [id]: value }));
    if (errors[id]) {
      setErrors(prev => {
        const newErrs = { ...prev };
        delete newErrs[id];
        return newErrs;
      });
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.firstName?.trim()) newErrors.firstName = "First name is required.";
    if (!formData.lastName?.trim()) newErrors.lastName = "Last name is required.";
    
    if (!formData.email?.trim()) {
      newErrors.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address.";
    }
    
    if (!formData.phone?.trim()) {
      newErrors.phone = "Phone number is required.";
    } else if (!/^\+?[\d\s\-()]{7,}$/.test(formData.phone)) {
      newErrors.phone = "Please enter a valid phone number.";
    }
    
    if (!formData.id?.trim()) newErrors.id = "ID number is required.";
    if (!formData.taxId?.trim()) newErrors.taxId = "Tax verification number is required.";
    if (!formData.country?.trim()) newErrors.country = "Identification country is required.";
    if (!formData.address?.trim()) newErrors.address = "Address is required.";
    
    if (!gender) newErrors.gender = "Gender is required.";
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // fn to submit form data 
  const handleSubmit = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (validateForm()) {
      console.log({ avatar, gender, ...formData });
    }
  };

  //fn for rendering the input fields
  const renderInputField = ({ id, label, placeholder, type, helpText }: typeof formFields[number]) => {
    const hasError = !!errors[id];
    return (
      <div key={id} className="w-full">
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
          {label} <span className="text-red-500">*</span>
        </label>
        <input
          type={type}
          id={id}
          placeholder={placeholder}
          className={`w-full text-gray-900 text-sm px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#2600FF] focus:border-transparent ${
            hasError ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:border-[#2600FF]'
          }`}
          value={formData[id] || ""}
          onChange={(e) => handleInputChange(id, e.target.value)}
        />
        {hasError ? (
          <p className="mt-1 text-xs text-red-600" id={`${id}-error`}>{errors[id]}</p>
        ) : helpText ? (
          <p className="mt-1 text-xs text-gray-400" id={`${id}-help`}>{helpText}</p>
        ) : null}
      </div>
    );
  };

  return (
    <div className="bg-white md:p-6 rounded-xl flex-grow shadow-sm border border-gray-100 max-w-4xl mx-auto">
      <div className="mb-8 border-b border-gray-100 pb-4">
        <h2 className="text-xl font-bold text-gray-900">Profile Settings</h2>
        <p className="text-sm text-gray-500 mt-1">Manage your account information and identity details.</p>
      </div>

      {/* Avatar Section */}
      <div className="flex flex-col sm:flex-row items-center gap-6 mb-8 bg-gray-50 p-4 rounded-lg">
        <div className="relative w-20 h-20 cursor-pointer group">
          <Image
            src={avatar}
            alt="Profile"
            fill
            className="rounded-full object-cover border-2 border-white shadow-md group-hover:opacity-90"
            unoptimized={typeof avatar === "string"}
          />
          <span className="absolute bottom-0 right-0 text-white bg-[#2600FF] rounded-full p-1.5 shadow-sm">
            <Image src={Camera} alt="Upload" width={16} height={16} className="invert" />
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-gray-800">Your profile picture</p>
          <div className="flex items-center gap-3">
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
              <span className="inline-flex items-center justify-center px-4 py-2 bg-[#2600FF] hover:bg-[#1a00cc] text-white rounded-md text-sm font-medium shadow-sm transition-colors duration-200">
                Upload New
              </span>
            </label>
            <button
              type="button"
              onClick={() => setAvatar(profile)}
              className="px-4 py-2 cursor-pointer bg-white border border-gray-200 hover:bg-red-50 hover:border-red-200 hover:text-red-600 text-gray-700 rounded-md text-sm font-medium transition-all duration-200"
            >
              Delete Avatar
            </button>
          </div>
        </div>
      </div>

      {/* Input Fields organized by section */}
      <form className="space-y-8">
        {/* Section 1: Personal Info */}
        <div className="bg-white border border-gray-100 rounded-lg p-4 sm:p-6 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900 mb-1">Personal Information</h3>
          <p className="text-xs text-gray-500 mb-6">Enter your basic identification details.</p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {formFields.filter(f => f.group === 'personal').map(renderInputField)}
            
            {/* Gender */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Gender <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-4 mt-2">
                {["male", "female"].map((g) => (
                  <label key={g} className={`flex items-center gap-3 border px-4 py-2.5 rounded-lg cursor-pointer transition-all duration-200 flex-1 sm:flex-initial ${
                    gender === g 
                      ? 'border-[#2600FF] bg-[#2600FF]/5 text-[#2600FF]' 
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}>
                    <input
                      type="radio"
                      name="gender"
                      value={g}
                      checked={gender === g}
                      onChange={() => {
                        setGender(g as "male" | "female");
                        if (errors.gender) {
                          setErrors(prev => {
                            const newErrs = { ...prev };
                            delete newErrs.gender;
                            return newErrs;
                          });
                        }
                      }}
                      className="h-4 w-4 text-[#2600FF] border-gray-300 focus:ring-[#2600FF]"
                    />
                    <span className="text-sm font-medium capitalize">{g}</span>
                  </label>
                ))}
              </div>
              {errors.gender ? (
                <p className="mt-1 text-xs text-red-600" id="gender-error">{errors.gender}</p>
              ) : (
                <p className="mt-1 text-xs text-gray-400" id="gender-help">Select your gender.</p>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Contact Details */}
        <div className="bg-white border border-gray-100 rounded-lg p-4 sm:p-6 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900 mb-1">Contact Details</h3>
          <p className="text-xs text-gray-500 mb-6">How we can reach you.</p>
          
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {formFields.filter(f => f.group === 'contact').map(renderInputField)}
            </div>
            
            {/* Address */}
            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                Address <span className="text-red-500">*</span>
              </label>
              <textarea
                id="address"
                placeholder="Enter your full residential address"
                rows={3}
                className={`w-full px-3 py-2 border text-sm text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2600FF] focus:border-transparent ${
                  errors.address ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:border-[#2600FF]'
                }`}
                value={formData["address"] || ""}
                onChange={(e) => handleInputChange("address", e.target.value)}
              ></textarea>
              {errors.address ? (
                <p className="mt-1 text-xs text-red-600" id="address-error">{errors.address}</p>
              ) : (
                <p className="mt-1 text-xs text-gray-400" id="address-help">Current residential address.</p>
              )}
            </div>
          </div>
        </div>

        {/* Section 3: Identity Verification */}
        <div className="bg-white border border-gray-100 rounded-lg p-4 sm:p-6 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900 mb-1">Identity Verification</h3>
          <p className="text-xs text-gray-500 mb-6">Financial and legal identification information.</p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {formFields.filter(f => f.group === 'verification').map(renderInputField)}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <button
            onClick={handleSubmit}
            type="button"
            className="sm:px-12 py-2.5 text-sm cursor-pointer bg-[#2600FF] hover:bg-[#1a00cc] text-white rounded-md font-medium shadow-md transition-colors duration-200 text-center order-1 sm:order-none"
          >
            Save Changes
          </button>

          <button
            type="button"
            className="sm:px-12 py-2.5 text-sm cursor-pointer hover:bg-gray-50 bg-white border border-gray-200 text-gray-700 rounded-md font-medium transition-colors duration-200 text-center"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProfileForm;

