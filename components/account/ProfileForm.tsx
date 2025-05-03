import React, { useState, ChangeEvent, MouseEvent } from "react";
import Image, { StaticImageData } from "next/image";
import profile from "@/public/images/profile-pic.png";
import Camera from "@/public/camera-ai-fill.svg"; // adjust the path if needed


const formFields = [
  { id: "firstName", label: "First Name", placeholder: " John", type: "text" },
  { id: "lastName", label: "Last Name", placeholder: " Snow", type: "text" },
  { id: "email", label: "Email", placeholder: "johnsnow@gmail.com", type: "email" },
  { id: "phone", label: "Phone Number", placeholder: " 555-123-4567", type: "tel" },
  { id: "id", label: "ID", placeholder: " 12345", type: "text" },
  { id: "taxId", label: "Tax Verification Number", placeholder: " SSN or EIN", type: "text" },
  { id: "country", label: "Identification Country", placeholder: " USA", type: "text" },
];

const ProfileForm: React.FC = () => {
  const [avatar, setAvatar] = useState<string | StaticImageData>(profile);
  const [gender, setGender] = useState<"male" | "female" | "">("");
  const [formData, setFormData] = useState<Record<string, string>>({});

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
  };

  //fn for rendering the input fields
  const renderInputField = ({ id, label, placeholder, type }: typeof formFields[number]) => (
    <div key={id}>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label} <span className="text-red-500">*</span>
      </label>
      <input
        type={type}
        id={id}
        placeholder={placeholder}
        className="w-full text-[#8F8989] text-sm px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-[#2600FF]"
        value={formData[id] || ""}
        onChange={(e) => handleInputChange(id, e.target.value)}
      />
    </div>
  );

  //fn to submit form data 
  const handleSubmit = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    console.log({ avatar, gender, ...formData });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 flex-grow">
      <h2 className="text-lg font-semibold text-gray-800 mb-6">Profile</h2>

      {/* Avatar Section */}
      <div className="flex flex-col sm:flex-row items-center gap-4 mb-8">
        <div className="relative sm:w-16 sm:h-16 w-25 h-25 cursor-pointer">
          <Image
            src={avatar}
            alt="Profile"
            fill
            className="rounded-full object-cover border border-gray-200"
            unoptimized={typeof avatar === "string"}
          />
          <span className="absolute bottom-0 right-0 text-white bg-[#FFFFFF] rounded-full p-1 sm:w-5 sm:h-5 w-8 h-8 flex items-center justify-center">
            <Image src={Camera} alt="Upload" width={50} height={50} />
          </span>
        </div>

        <div className="flex gap-2">
          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
            <span className="inline-flex items-center justify-center p-2 sm:px-4 sm:py-2 bg-[#2600FF] text-white rounded-md sm:text-sm text-[12px]">
              Upload Photo
            </span>
          </label>
          <button
            type="button"
            onClick={() => setAvatar(profile)}
            className="sm:px-4 sm:py-2 p-2 cursor-pointer bg-[#D9D9D9] hover:bg-red-600 hover:text-white text-gray-700 rounded-md sm:text-sm text-[12px]"
          >
            Delete Avatar
          </button>
        </div>
      </div>

      {/* Input Fields */}
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {formFields.slice(0, 2).map(renderInputField)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {formFields.slice(2, 4).map(renderInputField)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Gender Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Gender <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-8 mt-2">
              {["male", "female"].map((g) => (
                <label key={g} className="inline-flex items-center">
                  <input
                    type="radio"
                    name="gender"
                    value={g}
                    checked={gender === g}
                    onChange={() => setGender(g as "male" | "female")}
                    className="h-4 w-4 text-violet-600"
                  />
                  <span className="ml-2 text-sm text-gray-700 capitalize">{g}</span>
                </label>
              ))}
            </div>
          </div>

          {renderInputField(formFields[4])}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {formFields.slice(5).map(renderInputField)}
        </div>

        {/* Address */}
        <div>
          <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
            Address <span className="text-red-500">*</span>
          </label>
          <textarea
            id="address"
            placeholder="Address"
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none  focus:border-[#2600FF]"
            value={formData["address"] || ""}
            onChange={(e) => handleInputChange("address", e.target.value)}
          ></textarea>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">

        <button
            type="button"
            className="sm:px-12 px-8 py-1 text-sm cursor-pointer hover:bg-[#D9D9D9] bg-white border border-gray-300 text-[#2600FF] rounded-md "
          >
            Cancel
          </button>

          <button
            onClick={handleSubmit}
            type="button"
            className="sm:px-12 px-8 py-1 text-sm cursor-pointer bg-[#2600FF] text-white rounded-md font-medium"
          >
            Save
          </button>

        </div>
      </div>
    </div>
  );
};

export default ProfileForm;
