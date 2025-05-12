import React, { useState, ChangeEvent, MouseEvent } from "react";
import Image, { StaticImageData } from "next/image";
import profile from "@/public/images/p-Picture.jpg";
import Camera from "@/public/camera-ai-fill.svg"; 


const formFields = [
  { id: "firstName", label: "First Name", placeholder: "Ex.John", type: "text" },
  { id: "lastName", label: "Last Name", placeholder: "Ex.Doe", type: "text" },
  { id: "email", label: "Email", placeholder: "johndoe@gmail.com", type: "email" },
  { id: "phone", label: "Phone Number", placeholder: " Ex.Doe", type: "tel" },
  { id: "id", label: "ID", placeholder: " Ex.Doe", type: "text" },
  { id: "taxId", label: "Tax Verification Number", placeholder: " Ex.Doe", type: "text" },
  { id: "country", label: "Identification Country", placeholder: " Ex.Doe", type: "text" },
];

const ProfileForm: React.FC = () => {
  const [avatar, setAvatar] = useState<string | StaticImageData>(profile);
  const [gender, setGender] = useState<"male" | "female" | "">("");
  const [formData, setFormData] = useState<Record<string, string>>({
    address : ''
  });

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
        className="w-full text-gray-900 text-sm  px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-[#2600FF]"
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
    <div className="bg-white  md:p-2 flex-grow">
      <h2 className="text-lg font-semibold text-gray-800 mb-6">Profile</h2>

      {/* Avatar Section */}
      <div className="flex  sm:flex-row gap-2 sm:gap-10 mb-8">
        <div className="relative sm:w-18 sm:h-18 w-20 h-20 cursor-pointer">
          <Image
            src={avatar}
            alt="Profile"
            fill
            className="rounded-full object-cover border border-gray-200"
            unoptimized={typeof avatar === "string"}
          />
          <span className="absolute bottom-0 right-0 text-white bg-[#FFFFFF] rounded-full p-1 sm:w-7 sm:h-7 w-8 h-8 flex items-center justify-center">
            <Image src={Camera} alt="Upload" width={50} height={50} />
          </span>
        </div>

        <div className="flex items-center gap-3 mt-8">
          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
            <span className="inline-flex items-center justify-center px-3 py-[5px] sm:px-6 sm:py-[5px] bg-[#2600FF] text-white rounded-md sm:text-sm text-[12px]">
              Upload New
            </span>
          </label>
          <button
            type="button"
            onClick={() => setAvatar(profile)}
            className=" px-3 py-[5px] sm:px-6 sm:py-[5px] cursor-pointer bg-[#D9D9D9] hover:bg-red-600 hover:text-white text-gray-700 rounded-md sm:text-sm text-[12px]"
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
        <div className="grid grid-cols-1 items-center md:grid-cols-2 gap-4">

          {/* Gender Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Gender <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center justify-between sm:gap-8 mt-2">
              {["male", "female"].map((g) => (
                <label key={g} className="inline-flex gap-12 border-1 border-gray-100  p-2 rounded-md items-center">
                  <span className="text-sm text-gray-700 capitalize">{g}</span>
                  <input
                    type="radio"
                    name="gender"
                    value={g}
                    checked={gender === g}
                    onChange={() => setGender(g as "male" | "female")}
                    className="h-4 w-4 text-violet-600 cursor-pointer"
                  />
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
            className="w-full px-3 py-2 border text-sm text-gray-900 border-gray-300 rounded-md focus:outline-none focus:border-[#2600FF]"
            value={formData["address"] || ""}
            onChange={(e) => handleInputChange("address", e.target.value)}
          ></textarea>

        </div>

        {/* Buttons */}
        <div className="flex gap-3">

        <button
            onClick={handleSubmit}
            type="button"
            className="sm:px-12 px-8 py-1 text-sm cursor-pointer bg-[#2600FF] text-white rounded-md font-medium"
          >
            Save
        </button>

        <button
            type="button"
            className="sm:px-12 px-8 py-1 text-sm cursor-pointer hover:bg-[#D9D9D9] bg-white border border-gray-300 text-[#2600FF] rounded-md "
          >
            Cancel
        </button>

          
        </div>
      </div>
    </div>
  );
};

export default ProfileForm;
