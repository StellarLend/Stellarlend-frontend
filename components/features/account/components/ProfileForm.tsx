import React, { useState, ChangeEvent } from "react";
import Image, { StaticImageData } from "next/image";
import profile from "@/public/images/p-Picture.jpg";
import Camera from "@/public/camera-ai-fill.svg"; 
import { Input } from "@/components/shared/ui/Input";
import Button from "@/components/shared/ui/Button";

const formFields = [
  { id: "firstName", label: "First Name", placeholder: "Ex. John", type: "text", required: true },
  { id: "lastName", label: "Last Name", placeholder: "Ex. Doe", type: "text", required: true },
  { id: "email", label: "Email", placeholder: "johndoe@gmail.com", type: "email", required: true },
  { id: "phone", label: "Phone Number", placeholder: "Ex. +1234567890", type: "tel", required: true },
  { id: "id", label: "ID", placeholder: "Ex. ID123456", type: "text", required: true },
  { id: "taxId", label: "Tax Verification Number", placeholder: "Ex. TAX123456", type: "text", required: false },
  { id: "country", label: "Identification Country", placeholder: "Ex. United States", type: "text", required: true },
];

const ProfileForm: React.FC = () => {
  const [avatar, setAvatar] = useState<string | StaticImageData>(profile);
  const [gender, setGender] = useState<"male" | "female" | "">("");
  const [formData, setFormData] = useState<Record<string, string>>({
    address: ""
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    // Clear error when user types
    if (errors[id]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    formFields.forEach(field => {
      if (field.required && !formData[field.id]) {
        newErrors[field.id] = `${field.label} is required`;
      }
    });

    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Invalid email format";
    }

    if (!gender) {
      newErrors.gender = "Gender is required";
    }

    if (!formData.address) {
      newErrors.address = "Address is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  //fn to submit form data 
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      setIsSubmitting(true);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log({ avatar, gender, ...formData });
      setIsSubmitting(false);
      alert("Profile updated successfully!");
    }
  };

  return (
    <div className="bg-white md:p-2 flex-grow">
      <h2 className="text-lg font-semibold text-gray-800 mb-6">Profile</h2>

      {/* Avatar Section */}
      <div className="flex sm:flex-row gap-2 sm:gap-10 mb-8">
        <div className="relative sm:w-18 sm:h-18 w-20 h-20 cursor-pointer group">
          <Image
            src={avatar}
            alt="Profile"
            fill
            className="rounded-full object-cover border border-gray-200"
            unoptimized={typeof avatar === "string"}
          />
          <div className="absolute inset-0 bg-black/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
             <Image src={Camera} alt="Upload" width={24} height={24} className="invert" />
          </div>
          <span className="absolute bottom-0 right-0 text-white bg-white rounded-full p-1 sm:w-7 sm:h-7 w-8 h-8 flex items-center justify-center shadow-sm">
            <Image src={Camera} alt="Upload" width={20} height={20} />
          </span>
          <input
            type="file"
            accept="image/*"
            className="absolute inset-0 opacity-0 cursor-pointer"
            onChange={handleAvatarUpload}
          />
        </div>

        <div className="flex items-center gap-3 mt-4 sm:mt-0">
          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
            <span className="inline-flex items-center justify-center px-4 py-2 bg-[#2600FF] text-white rounded-md text-sm font-medium hover:bg-[#1E00CC] transition-colors">
              Upload New
            </span>
          </label>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setAvatar(profile)}
            className="text-gray-700 hover:bg-red-50 hover:text-red-600"
          >
            Delete Avatar
          </Button>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {formFields.map((field) => (
            <Input
              key={field.id}
              id={field.id}
              label={field.label}
              type={field.type}
              placeholder={field.placeholder}
              required={field.required}
              value={formData[field.id] || ""}
              error={errors[field.id]}
              onChange={(e) => handleInputChange(field.id, e.target.value)}
            />
          ))}

          {/* Gender Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Gender <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-4">
              {["male", "female"].map((g) => (
                <label
                  key={g}
                  className={cn(
                    "flex-1 flex items-center justify-between px-4 py-2.5 border rounded-lg cursor-pointer transition-all",
                    gender === g 
                      ? "border-[#2600FF] bg-blue-50 text-[#2600FF]" 
                      : "border-gray-200 hover:border-gray-300 text-gray-700"
                  )}
                >
                  <span className="text-sm capitalize font-medium">{g}</span>
                  <input
                    type="radio"
                    name="gender"
                    value={g}
                    checked={gender === g}
                    onChange={() => {
                      setGender(g as "male" | "female");
                      if (errors.gender) {
                        setErrors(prev => {
                          const next = { ...prev };
                          delete next.gender;
                          return next;
                        });
                      }
                    }}
                    className="h-4 w-4 accent-[#2600FF]"
                  />
                </label>
              ))}
            </div>
            {errors.gender && (
              <p className="text-xs text-red-500 mt-1.5">{errors.gender}</p>
            )}
          </div>
        </div>

        {/* Address */}
        <Input
          multiline
          id="address"
          label="Address"
          placeholder="Enter your full address"
          required
          rows={3}
          value={formData.address || ""}
          error={errors.address}
          onChange={(e) => handleInputChange("address", e.target.value)}
        />

        {/* Buttons */}
        <div className="flex gap-4 pt-4">
          <Button
            type="submit"
            isLoading={isSubmitting}
            className="px-12"
          >
            Save Changes
          </Button>

          <Button
            type="button"
            variant="outline"
            className="px-12"
            onClick={() => window.location.reload()}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ProfileForm;

