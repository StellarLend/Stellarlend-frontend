import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { validateProfile } from "@/lib/account/validation";
import { profileRepository } from "@/lib/account/repository";
import { withCsrfProtection } from "@/lib/api/handler";


export async function GET(req: NextRequest): Promise<NextResponse> {
    let user;
    try {
        user = requireAuth(req);
    } catch (res) {
        return res as NextResponse;
    }

    const profile = await profileRepository.getByUserId(user.id);


    return NextResponse.json(
        profile ?? {
            userId: user.id,
            displayName: "",
            bio: "",
            timezone: "UTC",
            updatedAt: null,
        }
    );
}


const putHandler = async (req: NextRequest): Promise<NextResponse> => {
    let user;
    try {
        user = requireAuth(req);
    } catch (res) {
        return res as NextResponse;
    }

    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const validation = validateProfile(body);
    if (!validation.success) {
        return NextResponse.json({ errors: validation.errors }, { status: 422 });
    }

    const record = await profileRepository.upsert(user.id, validation.data);
    return NextResponse.json(record);
};

export const PUT = withCsrfProtection(putHandler);