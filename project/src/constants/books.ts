export interface NcertBook {
    class: string;
    subject: string;
    title: string;
    url: string;
}

export const NCERT_BOOKS: NcertBook[] = [
    // Class 12
    { class: '12', subject: 'Physics', title: 'Physics Part I', url: 'https://ncert.nic.in/textbook.php?leph1=0-8' },
    { class: '12', subject: 'Physics', title: 'Physics Part II', url: 'https://ncert.nic.in/textbook.php?leph2=0-6' },
    { class: '12', subject: 'Chemistry', title: 'Chemistry Part I', url: 'https://ncert.nic.in/textbook.php?lech1=0-5' },
    { class: '12', subject: 'Chemistry', title: 'Chemistry Part II', url: 'https://ncert.nic.in/textbook.php?lech2=0-4' },
    { class: '12', subject: 'Maths', title: 'Mathematics Part I', url: 'https://ncert.nic.in/textbook.php?lemh1=0-6' },
    { class: '12', subject: 'Maths', title: 'Mathematics Part II', url: 'https://ncert.nic.in/textbook.php?lemh2=0-7' },
    { class: '12', subject: 'Biology', title: 'Biology', url: 'https://ncert.nic.in/textbook.php?lebo1=0-13' },
    { class: '12', subject: 'English', title: 'Flamingo', url: 'https://ncert.nic.in/textbook.php?lefl1=0-8' },

    // Class 11
    { class: '11', subject: 'Physics', title: 'Physics Part I', url: 'https://ncert.nic.in/textbook.php?keph1=0-8' },
    { class: '11', subject: 'Physics', title: 'Physics Part II', url: 'https://ncert.nic.in/textbook.php?keph2=0-7' },
    { class: '11', subject: 'Chemistry', title: 'Chemistry Part I', url: 'https://ncert.nic.in/textbook.php?kech1=0-6' },
    { class: '11', subject: 'Chemistry', title: 'Chemistry Part II', url: 'https://ncert.nic.in/textbook.php?kech2=0-3' },
    { class: '11', subject: 'Biology', title: 'Biology', url: 'https://ncert.nic.in/textbook.php?kebo1=0-19' },
    { class: '11', subject: 'Maths', title: 'Mathematics', url: 'https://ncert.nic.in/textbook.php?kemh1=0-14' },

    // Class 10
    { class: '10', subject: 'Science', title: 'Science', url: 'https://ncert.nic.in/textbook.php?jesc1=0-13' },
    { class: '10', subject: 'Maths', title: 'Mathematics', url: 'https://ncert.nic.in/textbook.php?jemh1=0-14' },
    { class: '10', subject: 'Social Science', title: 'Contemporary India', url: 'https://ncert.nic.in/textbook.php?jess1=0-7' },
    { class: '10', subject: 'English', title: 'First Flight', url: 'https://ncert.nic.in/textbook.php?jeff1=0-9' },

    // Class 10 Tamil Nadu Board English Medium
    { class: '10_TN_EN', subject: 'Science', title: 'Science (English Medium)', url: 'https://ncert.nic.in/textbook.php?tnensc1=0-23' },
    { class: '10_TN_EN', subject: 'Maths', title: 'Mathematics (English Medium)', url: 'https://ncert.nic.in/textbook.php?tnenma1=0-8' },

    // Class 10 Tamil Nadu Board Tamil Medium
    { class: '10_TN_TM', subject: 'Science', title: 'Science (Tamil Medium)', url: 'https://ncert.nic.in/textbook.php?tntmsc1=0-23' },
    { class: '10_TN_TM', subject: 'Maths', title: 'Mathematics (Tamil Medium)', url: 'https://ncert.nic.in/textbook.php?tntmma1=0-8' },

    // Class 8 Tamil Nadu Board English Medium
    { class: '8_TN_EN', subject: 'Science', title: 'Science (English Medium)', url: 'https://ncert.nic.in/textbook.php?tnen8sc1=0-23' },
    { class: '8_TN_EN', subject: 'Maths', title: 'Mathematics (English Medium)', url: 'https://ncert.nic.in/textbook.php?tnen8ma1=0-7' },

    // Class 8 Tamil Nadu Board Tamil Medium
    { class: '8_TN_TM', subject: 'Science', title: 'Science (Tamil Medium)', url: 'https://ncert.nic.in/textbook.php?tntm8sc1=0-23' },
    { class: '8_TN_TM', subject: 'Maths', title: 'Mathematics (Tamil Medium)', url: 'https://ncert.nic.in/textbook.php?tntm8ma1=0-7' },

    // Class 9 Tamil Nadu Board English Medium
    { class: '9_TN_EN', subject: 'Science', title: 'Science (English Medium)', url: 'https://ncert.nic.in/textbook.php?tnen9sc1=0-25' },
    { class: '9_TN_EN', subject: 'Maths', title: 'Mathematics (English Medium)', url: 'https://ncert.nic.in/textbook.php?tnen9ma1=0-9' },

    // Class 9 Tamil Nadu Board Tamil Medium
    { class: '9_TN_TM', subject: 'Science', title: 'Science (Tamil Medium)', url: 'https://ncert.nic.in/textbook.php?tntm9sc1=0-25' },
    { class: '9_TN_TM', subject: 'Maths', title: 'Mathematics (Tamil Medium)', url: 'https://ncert.nic.in/textbook.php?tntm9ma1=0-9' },

    // Class 11 Tamil Nadu Board English Medium
    { class: '11_TN_EN', subject: 'Physics', title: 'Physics (English Medium)', url: 'https://ncert.nic.in/textbook.php?tnen11ph1=0-11' },
    { class: '11_TN_EN', subject: 'Chemistry', title: 'Chemistry (English Medium)', url: 'https://ncert.nic.in/textbook.php?tnen11ch1=0-14' },
    { class: '11_TN_EN', subject: 'Biology', title: 'Biology (English Medium)', url: 'https://ncert.nic.in/textbook.php?tnen11bi1=0-19' },
    { class: '11_TN_EN', subject: 'Maths', title: 'Mathematics (English Medium)', url: 'https://ncert.nic.in/textbook.php?tnen11ma1=0-12' },

    // Class 11 Tamil Nadu Board Tamil Medium
    { class: '11_TN_TM', subject: 'Physics', title: 'Physics (Tamil Medium)', url: 'https://ncert.nic.in/textbook.php?tntm11ph1=0-11' },
    { class: '11_TN_TM', subject: 'Chemistry', title: 'Chemistry (Tamil Medium)', url: 'https://ncert.nic.in/textbook.php?tntm11ch1=0-14' },
    { class: '11_TN_TM', subject: 'Biology', title: 'Biology (Tamil Medium)', url: 'https://ncert.nic.in/textbook.php?tntm11bi1=0-19' },
    { class: '11_TN_TM', subject: 'Maths', title: 'Mathematics (Tamil Medium)', url: 'https://ncert.nic.in/textbook.php?tntm11ma1=0-12' },

    // Class 12 Tamil Nadu Board English Medium
    { class: '12_TN_EN', subject: 'Physics', title: 'Physics (English Medium)', url: 'https://ncert.nic.in/textbook.php?tnen12ph1=0-11' },
    { class: '12_TN_EN', subject: 'Chemistry', title: 'Chemistry (English Medium)', url: 'https://ncert.nic.in/textbook.php?tnen12ch1=0-15' },
    { class: '12_TN_EN', subject: 'Biology', title: 'Biology (English Medium)', url: 'https://ncert.nic.in/textbook.php?tnen12bi1=0-13' },
    { class: '12_TN_EN', subject: 'Maths', title: 'Mathematics (English Medium)', url: 'https://ncert.nic.in/textbook.php?tnen12ma1=0-12' },

    // Class 12 Tamil Nadu Board Tamil Medium
    { class: '12_TN_TM', subject: 'Physics', title: 'Physics (Tamil Medium)', url: 'https://ncert.nic.in/textbook.php?tntm12ph1=0-11' },
    { class: '12_TN_TM', subject: 'Chemistry', title: 'Chemistry (Tamil Medium)', url: 'https://ncert.nic.in/textbook.php?tntm12ch1=0-15' },
    { class: '12_TN_TM', subject: 'Biology', title: 'Biology (Tamil Medium)', url: 'https://ncert.nic.in/textbook.php?tntm12bi1=0-13' },
    { class: '12_TN_TM', subject: 'Maths', title: 'Mathematics (Tamil Medium)', url: 'https://ncert.nic.in/textbook.php?tntm12ma1=0-12' },

    // Class 9
    { class: '9', subject: 'Science', title: 'Science', url: 'https://ncert.nic.in/textbook.php?iesc1=0-12' },
    { class: '9', subject: 'Maths', title: 'Mathematics', url: 'https://ncert.nic.in/textbook.php?iemh1=0-12' },
    { class: '9', subject: 'Social Science', title: 'Democratic Politics', url: 'https://ncert.nic.in/textbook.php?ieps1=0-5' },
    { class: '9', subject: 'English', title: 'Beehive', url: 'https://ncert.nic.in/textbook.php?iebe1=0-9' },

    // Class 8
    { class: '8', subject: 'Science', title: 'Science', url: 'https://ncert.nic.in/textbook.php?hesc1=0-13' },
    { class: '8', subject: 'Maths', title: 'Mathematics', url: 'https://ncert.nic.in/textbook.php?hemh1=0-13' },
    { class: '8', subject: 'Social Science', title: 'Our Pasts - III', url: 'https://ncert.nic.in/textbook.php?hesp1=0-8' },
    { class: '8', subject: 'English', title: 'Honeydew', url: 'https://ncert.nic.in/textbook.php?hehd1=0-8' },
];
