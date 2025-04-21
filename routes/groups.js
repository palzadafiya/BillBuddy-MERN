const express = require('express');
const router = express.Router();
const Group = require('../models/Group');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// @route   POST /api/groups
// @desc    Create a new group
// @access  Private
router.post('/', protect, async (req, res) => {
  try {
    const { name, description, members } = req.body;

    // Find or create users for each email
    const memberUsers = await Promise.all(
      members.map(async ({ email }) => {
        let user = await User.findOne({ email });
        if (!user) {
          // Create a new user if they don't exist
          user = new User({
            name: email.split('@')[0], // Use email username as default name
            email,
            password: Math.random().toString(36).slice(-8), // Generate random password
          });
          await user.save();
        }
        return user._id;
      })
    );

    // Create new group
    const group = new Group({
      name,
      description,
      members: [
        { user: req.user.id, balance: 0 },
        ...memberUsers.map(userId => ({ user: userId, balance: 0 }))
      ],
      createdBy: req.user.id
    });

    await group.save();

    // Add group to users' groups array
    await User.updateMany(
      { _id: { $in: [req.user.id, ...memberUsers] } },
      { $push: { groups: group._id } }
    );

    // Populate the response with user details
    const populatedGroup = await Group.findById(group._id)
      .populate('members.user', 'name email')
      .populate('createdBy', 'name email');

    res.status(201).json(populatedGroup);
  } catch (error) {
    console.error('Error creating group:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/groups
// @desc    Get all groups for current user
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const groups = await Group.find({ 'members.user': req.user.id })
      .populate('members.user', 'name email')
      .populate('createdBy', 'name email');

    res.json(groups);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/groups/:id
// @desc    Get single group
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate('members.user', 'name email')
      .populate('createdBy', 'name email')
      .populate('expenses');

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is a member of the group
    const isMember = group.members.some(
      member => member.user._id.toString() === req.user.id
    );

    if (!isMember) {
      return res.status(403).json({ message: 'Not authorized to access this group' });
    }

    res.json(group);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/groups/:id
// @desc    Update group
// @access  Private
router.put('/:id', protect, async (req, res) => {
  try {
    const { name, description, members } = req.body;

    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is the creator of the group
    if (group.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this group' });
    }

    // Update group
    group.name = name || group.name;
    group.description = description || group.description;

    if (members) {
      // Remove old members
      const oldMembers = group.members.map(member => member.user.toString());
      await User.updateMany(
        { _id: { $in: oldMembers } },
        { $pull: { groups: group._id } }
      );

      // Add new members
      group.members = [
        { user: req.user.id, balance: 0 },
        ...members.map(member => ({ user: member, balance: 0 }))
      ];

      // Add group to new members' groups array
      await User.updateMany(
        { _id: { $in: [req.user.id, ...members] } },
        { $push: { groups: group._id } }
      );
    }

    await group.save();

    res.json(group);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/groups/:id
// @desc    Delete group
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is the creator of the group
    if (group.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this group' });
    }

    // Remove group from users' groups array
    await User.updateMany(
      { _id: { $in: group.members.map(member => member.user) } },
      { $pull: { groups: group._id } }
    );

    await group.remove();

    res.json({ message: 'Group removed' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/groups/:id/members
// @desc    Add a member to a group
// @access  Private
router.post('/:id/members', protect, async (req, res) => {
  try {
    const { email } = req.body;
    const groupId = req.params.id;

    if (!groupId) {
      return res.status(400).json({ message: 'Group ID is required' });
    }

    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is the creator of the group
    if (group.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to add members to this group' });
    }

    // Find user by email
    const userToAdd = await User.findOne({ email });

    if (!userToAdd) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user is already a member
    const isAlreadyMember = group.members.some(
      member => member.user.toString() === userToAdd._id.toString()
    );

    if (isAlreadyMember) {
      return res.status(400).json({ message: 'User is already a member of this group' });
    }

    // Add user to group members
    group.members.push({ user: userToAdd._id, balance: 0 });
    await group.save();

    // Add group to user's groups array
    await User.findByIdAndUpdate(userToAdd._id, {
      $push: { groups: group._id }
    });

    // Populate the response with user details
    const updatedGroup = await Group.findById(groupId)
      .populate('members.user', 'name email')
      .populate('createdBy', 'name email');

    res.json(updatedGroup);
  } catch (error) {
    console.error('Error adding member:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 